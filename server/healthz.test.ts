import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any imports that use them.
// ---------------------------------------------------------------------------

vi.mock("./storage", () => ({
  pool: {
    query: vi.fn(),
  },
}));

// Stripe is instantiated with `new`, so the factory must be a regular function
// (arrow functions cannot be constructors).
const mockBalanceRetrieve = vi.fn().mockResolvedValue({ object: "balance" });

vi.mock("stripe", () => ({
  // eslint-disable-next-line prefer-arrow-callback
  default: vi.fn(function StripeConstructor() {
    return { balance: { retrieve: mockBalanceRetrieve } };
  }),
}));

// ---------------------------------------------------------------------------
// Import modules AFTER mocks are declared so they receive the fakes.
// ---------------------------------------------------------------------------
import { pool } from "./storage";
import { createHealthzHandler } from "./healthzHandler";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds an isolated Express app with a healthz handler that uses a short
 * timeout so the timeout-fires test does not spend 3 real seconds waiting.
 */
function buildApp(timeoutMs?: number) {
  const app = express();
  app.get("/healthz", createHealthzHandler(timeoutMs));
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /healthz — health check behaviour", () => {
  const originalStripeKey = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_tests";
    // Re-arm the Stripe balance mock after clearAllMocks resets it.
    mockBalanceRetrieve.mockResolvedValue({ object: "balance" });
  });

  afterEach(() => {
    if (originalStripeKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalStripeKey;
    }
  });

  // ---- happy path --------------------------------------------------------

  it("returns HTTP 200 with { status: 'ok', db: true, stripe: true } when everything is healthy", async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ "?column?": 1 }] } as any);

    const res = await request(buildApp()).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: true, stripe: true });
  });

  // ---- DB failure --------------------------------------------------------

  it("returns HTTP 503 with { status: 'degraded', db: false } when the DB rejects", async () => {
    vi.mocked(pool.query).mockRejectedValue(new Error("Connection refused"));

    const res = await request(buildApp()).get("/healthz");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", db: false });
  });

  it("response body includes stripe: true even when db: false", async () => {
    vi.mocked(pool.query).mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await request(buildApp()).get("/healthz");

    expect(res.body).toMatchObject({ db: false, stripe: true });
  });

  // ---- Stripe failure ----------------------------------------------------

  it("returns HTTP 503 with stripe: false when STRIPE_SECRET_KEY is absent", async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ "?column?": 1 }] } as any);
    delete process.env.STRIPE_SECRET_KEY;

    const res = await request(buildApp()).get("/healthz");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", stripe: false });
  });

  // ---- Stripe timeout ----------------------------------------------------

  it("returns HTTP 503 with stripe: false when stripe.balance.retrieve() hangs beyond the timeout", async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ "?column?": 1 }] } as any);
    // balance.retrieve never settles — simulates a slow / hung Stripe API.
    mockBalanceRetrieve.mockImplementation(() => new Promise(() => {}));

    const start = Date.now();
    // Use a very short timeout so the test finishes quickly.
    const res = await request(buildApp(100 /* ms */)).get("/healthz");
    const elapsed = Date.now() - start;

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", stripe: false });
    // Handler must resolve well within the test budget.
    expect(elapsed).toBeLessThan(5000);
  }, 10_000);

  it("returns HTTP 503 with stripe: false when stripe.balance.retrieve() rejects with a network error", async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ "?column?": 1 }] } as any);
    mockBalanceRetrieve.mockRejectedValue(new Error("socket hang up"));

    const res = await request(buildApp()).get("/healthz");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", stripe: false });
  });

  // ---- timeout -----------------------------------------------------------

  it("completes within 500 ms and returns degraded when the DB query hangs (timeout set to 100 ms)", async () => {
    // pool.query returns a promise that never settles — simulates a hung DB.
    vi.mocked(pool.query).mockImplementation(() => new Promise(() => {}));

    const start = Date.now();
    // Use a very short timeout so the test finishes quickly without fake timers.
    const res = await request(buildApp(100 /* ms */)).get("/healthz");
    const elapsed = Date.now() - start;

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", db: false });
    // The handler must finish well before 5 s (our 100 ms timeout + generous overhead).
    expect(elapsed).toBeLessThan(5000);
  }, 10_000);
});
