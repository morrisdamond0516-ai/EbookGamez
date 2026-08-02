/**
 * Integration tests: Promo lock end-to-end lifecycle (webhook path)
 *
 * These tests exercise the real DB layer — the same SQL the route and webhook
 * handlers execute — to verify the full promo-lock lifecycle:
 *
 *   1. Acquire pending lock (pre-Stripe session)
 *   2. Bind session ID to pending lock (post-Stripe session create)
 *   3. Confirm lock on payment success (checkout.session.completed webhook)
 *   4. Release lock on session expiry (checkout.session.expired webhook)
 *   5. Orphaned-lock cleanup (pending with null sessionId + startup sweep)
 *
 * These tests call the real database; they are the source-of-truth for the
 * atomicity guarantee.
 */

import { describe, it, expect, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema";

const { promoUsages } = schema;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// Test fixtures — throw-away values that won't clash with real data
const TEST_EMAIL  = "promo-lifecycle-test@ebookgamez-test.invalid";
const TEST_CODE   = "WELCOME10";
const SESSION_1   = "cs_lifecycle_test_001";
const SESSION_2   = "cs_lifecycle_test_002";

async function cleanup() {
  await db.delete(promoUsages).where(
    sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`
  );
}

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Helpers that mirror the route / webhook handler logic exactly
// ---------------------------------------------------------------------------

/** Step 1: Acquire pending lock before Stripe session creation. */
async function acquireLock(email: string, code: string): Promise<"acquired" | "conflict"> {
  try {
    await db.insert(promoUsages).values({
      promoCode: code.toUpperCase(),
      customerEmail: email.toLowerCase(),
      stripeSessionId: null,
      status: "pending",
    });
    return "acquired";
  } catch (err: any) {
    const pgCode = err?.code ?? err?.cause?.code;
    if (pgCode === "23505") return "conflict";
    throw err;
  }
}

/** Step 2: Bind session ID to the pending lock after Stripe session is created. */
async function bindSession(email: string, code: string, sessionId: string): Promise<void> {
  await db.update(promoUsages)
    .set({ stripeSessionId: sessionId })
    .where(
      sql`${promoUsages.customerEmail} = ${email.toLowerCase()} AND ${promoUsages.promoCode} = ${code.toUpperCase()} AND ${promoUsages.status} = 'pending'`
    );
}

/** Step 3: Confirm lock on checkout.session.completed (mirrors checkoutHandler.ts).
 *
 * Matches by (customer_email, promo_code) and status='pending' so it handles the
 * crash window where stripeSessionId was never written (still null).
 */
async function confirmLock(sessionId: string, code: string, email: string, total: string): Promise<"confirmed" | "upserted">{
  const updated = await db.update(promoUsages)
    .set({ status: "confirmed", customerEmail: email, orderTotal: total, stripeSessionId: sessionId })
    .where(
      sql`${promoUsages.customerEmail} = ${email.toLowerCase()} AND ${promoUsages.promoCode} = ${code.toUpperCase()} AND ${promoUsages.status} = 'pending'`
    )
    .returning();
  if (updated.length > 0) return "confirmed";

  // No pending row found — use UPSERT so a duplicate webhook event on an already-confirmed
  // row is handled gracefully (DO UPDATE), and a genuinely new row is created correctly.
  await db.execute(
    sql`INSERT INTO promo_usages (promo_code, customer_email, stripe_session_id, order_total, status)
        VALUES (${code.toUpperCase()}, ${email.toLowerCase()}, ${sessionId}, ${total}, 'confirmed')
        ON CONFLICT (customer_email, promo_code)
        DO UPDATE SET status = 'confirmed', stripe_session_id = ${sessionId}, order_total = ${total}`
  );
  return "upserted";
}

/** Step 4: Release lock on checkout.session.expired (mirrors webhookHandlers.ts). */
async function releaseBySessionId(sessionId: string): Promise<number> {
  const deleted = await db.delete(promoUsages)
    .where(
      sql`${promoUsages.stripeSessionId} = ${sessionId} AND ${promoUsages.status} = 'pending'`
    )
    .returning();
  return deleted.length;
}

/** Step 5: Orphaned-lock cleanup (mirrors startup applyPromoSchemaChanges). */
async function cleanupOrphanedLocks(olderThanMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const deleted = await db.delete(promoUsages)
    .where(
      sql`${promoUsages.status} = 'pending' AND ${promoUsages.stripeSessionId} IS NULL AND ${promoUsages.createdAt} < ${cutoff}`
    )
    .returning();
  return deleted.length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Promo schema invariants", () => {
  it("unique index promo_usages_email_code_unique is present in the database", async () => {
    // This test is a guard: if the startup migration fails to create (or verify) the
    // unique index, concurrent checkout requests can both acquire a pending lock and
    // replay protection silently breaks.
    const result = await db.execute(
      sql`SELECT indexname FROM pg_indexes WHERE tablename = 'promo_usages' AND indexname = 'promo_usages_email_code_unique'`
    ) as any;
    const rows = result?.rows ?? result;
    expect(Array.isArray(rows) && rows.length > 0).toBe(true);
  });
});

describe("Promo lock lifecycle — end-to-end webhook flow", () => {
  it("acquire → bind → confirm: happy path (payment succeeds)", async () => {
    // Step 1: acquire pending lock before Stripe call
    const acquired = await acquireLock(TEST_EMAIL, TEST_CODE);
    expect(acquired).toBe("acquired");

    // Verify pending row exists with null session ID
    let rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].stripeSessionId).toBeNull();

    // Step 2: bind Stripe session ID
    await bindSession(TEST_EMAIL, TEST_CODE, SESSION_1);

    rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows[0].stripeSessionId).toBe(SESSION_1);

    // Step 3: confirm on payment success
    const confirmOutcome = await confirmLock(SESSION_1, TEST_CODE, TEST_EMAIL, "9.99");
    expect(confirmOutcome).toBe("confirmed");

    rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].orderTotal).toBe("9.99");
  });

  it("acquire → bind → expire: lock released, code reusable", async () => {
    await acquireLock(TEST_EMAIL, TEST_CODE);
    await bindSession(TEST_EMAIL, TEST_CODE, SESSION_1);

    // Step 4: session expires — release lock
    const released = await releaseBySessionId(SESSION_1);
    expect(released).toBe(1);

    // DB should have no remaining rows
    const rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows).toHaveLength(0);

    // Buyer can now retry with a new session
    const acquired2 = await acquireLock(TEST_EMAIL, TEST_CODE);
    expect(acquired2).toBe("acquired");
  });

  it("concurrent acquire: only one request can hold the lock", async () => {
    const first = await acquireLock(TEST_EMAIL, TEST_CODE);
    const second = await acquireLock(TEST_EMAIL, TEST_CODE);

    expect(first).toBe("acquired");
    expect(second).toBe("conflict");

    const rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows).toHaveLength(1);
  });

  it("crash-window confirm: pending row with null sessionId is promoted correctly", async () => {
    // Simulate server crash between INSERT(pending, null) and UPDATE(sessionId):
    // Row exists but stripeSessionId is null.
    await db.insert(promoUsages).values({
      promoCode: TEST_CODE,
      customerEmail: TEST_EMAIL,
      stripeSessionId: null,  // ← null because server crashed before binding
      status: "pending",
    });

    // Webhook fires with the real session ID — confirm logic matches by (email, code)
    const outcome = await confirmLock(SESSION_1, TEST_CODE, TEST_EMAIL, "9.99");
    expect(outcome).toBe("confirmed");

    const rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].stripeSessionId).toBe(SESSION_1);  // sessionId now set
    expect(rows[0].orderTotal).toBe("9.99");
  });

  it("confirm upsert: no pending row — upserts confirmed row (duplicate webhook / new row)", async () => {
    // No pending row exists — simulates server restart between INSERT and webhook
    const outcome = await confirmLock(SESSION_1, TEST_CODE, TEST_EMAIL, "9.99");
    expect(outcome).toBe("upserted");

    const rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("confirmed");
  });

  it("duplicate webhook: second confirmed webhook does not duplicate rows", async () => {
    // First webhook fires and creates confirmed row
    await confirmLock(SESSION_1, TEST_CODE, TEST_EMAIL, "9.99");

    // Second webhook fires (duplicate delivery) — ON CONFLICT DO UPDATE, no error, still 1 row
    const outcome2 = await confirmLock(SESSION_1, TEST_CODE, TEST_EMAIL, "9.99");
    expect(outcome2).toBe("upserted");

    const rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("confirmed");
  });

  it("orphaned lock cleanup removes pending rows with null sessionId older than threshold", async () => {
    // Insert orphaned lock with null sessionId
    await db.insert(promoUsages).values({
      promoCode: TEST_CODE,
      customerEmail: TEST_EMAIL,
      stripeSessionId: null,
      status: "pending",
    });

    // Cleanup with 0ms threshold (everything qualifies as old enough)
    const removed = await cleanupOrphanedLocks(0);
    expect(removed).toBeGreaterThanOrEqual(1);

    const rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows).toHaveLength(0);
  });

  it("confirmed row is not released by expiry webhook (only pending rows are deleted)", async () => {
    // Insert confirmed row (payment was successful)
    await db.insert(promoUsages).values({
      promoCode: TEST_CODE,
      customerEmail: TEST_EMAIL,
      stripeSessionId: SESSION_1,
      status: "confirmed",
    });

    // Session expiry fires (e.g. late duplicate) — should NOT delete confirmed row
    const released = await releaseBySessionId(SESSION_1);
    expect(released).toBe(0);

    const rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("confirmed");
  });

  it("expiry webhook does not release a lock that belongs to a different session", async () => {
    await acquireLock(TEST_EMAIL, TEST_CODE);
    await bindSession(TEST_EMAIL, TEST_CODE, SESSION_1);

    // Expiry fires for a different session (e.g. old abandoned session)
    const released = await releaseBySessionId(SESSION_2);
    expect(released).toBe(0);

    // Lock for SESSION_1 still intact
    const rows = await db.select().from(promoUsages)
      .where(sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].stripeSessionId).toBe(SESSION_1);
  });
});
