/**
 * Integration tests: Promo code replay prevention — real database layer
 *
 * These tests exercise the unique constraint on (customer_email, promo_code)
 * that enforces atomicity at the DB layer.  They connect to the real
 * development database and verify:
 *
 *   1. First INSERT of a pending lock succeeds.
 *   2. A concurrent second INSERT for the same (email, code) fails with
 *      PostgreSQL error code 23505 (unique_violation).
 *   3. Deleting the pending row releases the constraint so a retry succeeds.
 *   4. A confirmed row also blocks future inserts (permanent consumption).
 *
 * The tests clean up after themselves regardless of pass/fail.
 */

import { describe, it, expect, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "../shared/schema";

const { promoUsages } = schema;

// ---------------------------------------------------------------------------
// DB connection — uses the same DATABASE_URL as the app
// ---------------------------------------------------------------------------

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// Test fixtures — use a throwaway email/code that won't clash with real data
const TEST_EMAIL = "promo-test-integration@ebookgamez-test.invalid";
const TEST_CODE  = "TESTCODE_INTEGRATION";

async function cleanupTestRows() {
  await db.delete(promoUsages).where(
    sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE}`
  );
}

afterEach(async () => {
  await cleanupTestRows();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Promo lock — DB unique constraint enforcement", () => {
  it("allows the first INSERT for a new (email, code) pair", async () => {
    const rows = await db.insert(promoUsages).values({
      promoCode: TEST_CODE,
      customerEmail: TEST_EMAIL,
      stripeSessionId: "cs_test_lock_001",
      status: "pending",
    }).returning();

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].stripeSessionId).toBe("cs_test_lock_001");
  });

  it("rejects a concurrent second INSERT with the same (email, code) — error code 23505", async () => {
    // First lock succeeds
    await db.insert(promoUsages).values({
      promoCode: TEST_CODE,
      customerEmail: TEST_EMAIL,
      stripeSessionId: "cs_test_lock_001",
      status: "pending",
    });

    // Second attempt — simulates a concurrent request
    let thrownError: any;
    try {
      await db.insert(promoUsages).values({
        promoCode: TEST_CODE,
        customerEmail: TEST_EMAIL,
        stripeSessionId: "cs_test_lock_002",
        status: "pending",
      });
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    // Drizzle wraps the pg driver error in thrownError.cause
    const pgCode = thrownError?.code ?? thrownError?.cause?.code;
    expect(pgCode).toBe("23505");
  });

  it("allows a retry after the pending lock is deleted (session expiry flow)", async () => {
    // Acquire lock
    await db.insert(promoUsages).values({
      promoCode: TEST_CODE,
      customerEmail: TEST_EMAIL,
      stripeSessionId: "cs_test_lock_001",
      status: "pending",
    });

    // Simulate session expiry → delete pending row
    await db.delete(promoUsages).where(
      sql`${promoUsages.customerEmail} = ${TEST_EMAIL} AND ${promoUsages.promoCode} = ${TEST_CODE} AND ${promoUsages.status} = 'pending'`
    );

    // Retry succeeds
    const rows = await db.insert(promoUsages).values({
      promoCode: TEST_CODE,
      customerEmail: TEST_EMAIL,
      stripeSessionId: "cs_test_lock_002",
      status: "pending",
    }).returning();

    expect(rows).toHaveLength(1);
    expect(rows[0].stripeSessionId).toBe("cs_test_lock_002");
  });

  it("blocks a retry after a confirmed (paid) row exists", async () => {
    // Insert a confirmed row (payment completed)
    await db.insert(promoUsages).values({
      promoCode: TEST_CODE,
      customerEmail: TEST_EMAIL,
      stripeSessionId: "cs_test_lock_confirmed",
      status: "confirmed",
    });

    // Attempting a new checkout with the same code should fail
    let thrownError: any;
    try {
      await db.insert(promoUsages).values({
        promoCode: TEST_CODE,
        customerEmail: TEST_EMAIL,
        stripeSessionId: "cs_test_lock_003",
        status: "pending",
      });
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    const pgCode2 = thrownError?.code ?? thrownError?.cause?.code;
    expect(pgCode2).toBe("23505");
  });

  it("promotes a pending row to confirmed without touching other rows", async () => {
    await db.insert(promoUsages).values({
      promoCode: TEST_CODE,
      customerEmail: TEST_EMAIL,
      stripeSessionId: "cs_test_lock_001",
      status: "pending",
    });

    // Simulate webhook confirming payment
    const updated = await db.update(promoUsages)
      .set({ status: "confirmed" })
      .where(
        sql`${promoUsages.stripeSessionId} = 'cs_test_lock_001' AND ${promoUsages.status} = 'pending'`
      )
      .returning();

    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe("confirmed");
  });
});
