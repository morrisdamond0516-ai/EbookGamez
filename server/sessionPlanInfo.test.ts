import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { RequestHandler } from "express";

// ---------------------------------------------------------------------------
// Mock dependencies before importing any server module that uses them.
// ---------------------------------------------------------------------------

vi.mock("./stripeClient", () => ({
  getUncachableStripeClient: vi.fn(),
}));

vi.mock("./storage", () => {
  const fakePlan = {
    id: 1,
    name: "Value",
    tier: "value",
    monthlyPrice: "12.99",
    annualPrice: "129.90",
    readsPerMonth: 99999,
    downloadsPerMonth: 3,
    stripePriceId: "price_monthly_123",
    stripeAnnualPriceId: "price_annual_123",
    stripeProductId: "prod_123",
    isActive: true,
  };

  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([fakePlan]),
  };

  return {
    db: {
      select: vi.fn(() => selectChain),
    },
  };
});

// Replace auth middleware with a test double that injects verifiedEmail via a
// request header, so the production route wiring (requireSubscriptionAuth +
// subscriptionRateLimit) is replaced while everything else runs for real.
vi.mock("./subscriptionAuth", () => {
  const testAuthMiddleware: RequestHandler = (req, _res, next) => {
    const email = req.headers["x-test-verified-email"];
    if (typeof email === "string" && email) {
      (req as { verifiedEmail?: string }).verifiedEmail = email;
    }
    next();
  };

  return {
    requireSubscriptionAuth: testAuthMiddleware,
    subscriptionRateLimit: ((_req, _res, next: () => void) => next()) as RequestHandler,
  };
});

// ---------------------------------------------------------------------------
// Import the REAL production router extracted from routes.ts.
// ---------------------------------------------------------------------------
import { getUncachableStripeClient } from "./stripeClient";
import subscriptionSessionRouter from "./subscriptionSessionRoute";
import type { SessionPlanInfo } from "./subscriptionService";

// ---------------------------------------------------------------------------
// A Stripe checkout session that carries sensitive customer-identifying fields.
// These must never appear in the API response body.
// ---------------------------------------------------------------------------
const SENSITIVE_STRIPE_SESSION = {
  id: "cs_test_abc123",
  object: "checkout.session",
  customer_email: "alice@example.com",
  customer: "cus_sensitive_123",
  customer_details: {
    email: "alice@example.com",
    name: "Alice Smith",
    phone: "+15550001234",
    address: { country: "US" },
  },
  payment_intent: "pi_sensitive_456",
  payment_method: "pm_sensitive_789",
  metadata: {
    tier: "value",
    billingInterval: "monthly",
    planId: "1",
  },
  mode: "subscription",
  status: "complete",
  currency: "usd",
  amount_total: 1299,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(subscriptionSessionRouter);
  return app;
}

function hitRoute(app: ReturnType<typeof buildApp>, email: string) {
  return request(app)
    .get("/api/subscription/session/cs_test_abc123")
    .set("x-test-verified-email", email);
}

describe("GET /api/subscription/session/:sessionId — customer data redaction", () => {
  beforeEach(() => {
    vi.mocked(getUncachableStripeClient).mockResolvedValue({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue(SENSITIVE_STRIPE_SESSION),
        },
      },
    } as ReturnType<typeof getUncachableStripeClient> extends Promise<infer T> ? T : never);
  });

  it("responds with HTTP 200", async () => {
    const res = await hitRoute(buildApp(), "alice@example.com");
    expect(res.status).toBe(200);
  });

  it("response body contains exactly the five whitelisted fields", async () => {
    const res = await hitRoute(buildApp(), "alice@example.com");
    const keys = Object.keys(res.body as SessionPlanInfo);
    const allowed: Array<keyof SessionPlanInfo> = [
      "tier",
      "billingInterval",
      "planName",
      "monthlyPrice",
      "annualPrice",
    ];
    expect(keys.sort()).toEqual([...allowed].sort());
  });

  it("response body does not include customer_email or email", async () => {
    const { body } = await hitRoute(buildApp(), "alice@example.com");
    expect(body).not.toHaveProperty("customer_email");
    expect(body).not.toHaveProperty("email");
  });

  it("response body does not include the Stripe customer ID", async () => {
    const { body } = await hitRoute(buildApp(), "alice@example.com");
    expect(body).not.toHaveProperty("customer");
    expect(body).not.toHaveProperty("customerId");
  });

  it("response body does not include payment intent or payment method", async () => {
    const { body } = await hitRoute(buildApp(), "alice@example.com");
    expect(body).not.toHaveProperty("payment_intent");
    expect(body).not.toHaveProperty("payment_method");
    expect(body).not.toHaveProperty("paymentIntent");
    expect(body).not.toHaveProperty("paymentMethod");
  });

  it("response body does not include customer_details", async () => {
    const { body } = await hitRoute(buildApp(), "alice@example.com");
    expect(body).not.toHaveProperty("customer_details");
    expect(body).not.toHaveProperty("customerDetails");
  });

  it("response body contains the correct whitelisted plan values", async () => {
    const { body } = await hitRoute(buildApp(), "alice@example.com");
    expect(body).toEqual({
      tier: "value",
      billingInterval: "monthly",
      planName: "Value",
      monthlyPrice: "12.99",
      annualPrice: "129.90",
    });
  });

  it("returns HTTP 403 when the caller email does not own the session", async () => {
    const res = await hitRoute(buildApp(), "eve@attacker.com");
    expect(res.status).toBe(403);
  });

  it("returns HTTP 404 when the session has no tier metadata", async () => {
    vi.mocked(getUncachableStripeClient).mockResolvedValueOnce({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({
            ...SENSITIVE_STRIPE_SESSION,
            metadata: { billingInterval: "monthly" },
          }),
        },
      },
    } as ReturnType<typeof getUncachableStripeClient> extends Promise<infer T> ? T : never);

    const res = await hitRoute(buildApp(), "alice@example.com");
    expect(res.status).toBe(404);
  });
});
