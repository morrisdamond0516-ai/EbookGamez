/**
 * Tests: Promo code replay prevention
 *
 * Verifies the three-state lifecycle for one-time promo codes:
 *   1. No usage record  → code is valid
 *   2. Pending record   → code is blocked (in-flight checkout session)
 *   3. Confirmed record → code is blocked (payment completed)
 *   4. Expired session  → pending record removed → code valid again
 *
 * These tests exercise the validation logic in isolation without a live
 * database or Stripe connection.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Replicate the validation logic from POST /api/promo/validate and
// POST /api/checkout so we can test it without a running server.
// ---------------------------------------------------------------------------

type PromoStatus = "pending" | "confirmed";

interface PromoUsageRecord {
  promoCode: string;
  customerEmail: string;
  stripeSessionId: string | null;
  status: PromoStatus;
}

const VALID_PROMOS: Record<string, number> = {
  WELCOME10: 0.1,
  EBGZOWNER: 1.0,
  GOOGLETEST: 1.0,
};

const UNLIMITED_CODES = new Set(["EBGZOWNER", "GOOGLETEST"]);

/** Returns true when the code is currently blocked for this email. */
function isCodeBlocked(
  usages: PromoUsageRecord[],
  code: string,
  email: string
): boolean {
  const upper = code.toUpperCase().trim();
  if (UNLIMITED_CODES.has(upper)) return false;
  return usages.some(
    (u) =>
      u.promoCode === upper &&
      u.customerEmail === email.toLowerCase().trim() &&
      (u.status === "pending" || u.status === "confirmed")
  );
}

/**
 * Simulate the checkout creation logic:
 * - Checks for an existing pending/confirmed record first
 * - If clear, inserts a pending record and returns the new session ID
 * - If blocked, returns null
 */
function tryCreateCheckoutSession(
  usages: PromoUsageRecord[],
  code: string,
  email: string,
  newSessionId: string
): { sessionId: string } | { error: string } {
  const upper = code.toUpperCase().trim();
  if (!VALID_PROMOS[upper]) return { error: "Invalid promo code" };

  if (!UNLIMITED_CODES.has(upper)) {
    if (isCodeBlocked(usages, upper, email)) {
      return { error: "This promo code has already been used with this email" };
    }
    // Record pending lock
    usages.push({
      promoCode: upper,
      customerEmail: email.toLowerCase().trim(),
      stripeSessionId: newSessionId,
      status: "pending",
    });
  }
  return { sessionId: newSessionId };
}

/** Simulate the webhook handler confirming a session. */
function confirmSession(usages: PromoUsageRecord[], sessionId: string): void {
  const record = usages.find(
    (u) => u.stripeSessionId === sessionId && u.status === "pending"
  );
  if (record) {
    record.status = "confirmed";
  }
}

/** Simulate the session-expired webhook releasing the pending lock. */
function expireSession(usages: PromoUsageRecord[], sessionId: string): void {
  const idx = usages.findIndex(
    (u) => u.stripeSessionId === sessionId && u.status === "pending"
  );
  if (idx !== -1) usages.splice(idx, 1);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Promo code replay prevention", () => {
  it("allows a first-time use of WELCOME10", () => {
    const usages: PromoUsageRecord[] = [];
    const result = tryCreateCheckoutSession(
      usages,
      "WELCOME10",
      "buyer@example.com",
      "cs_test_001"
    );
    expect(result).toEqual({ sessionId: "cs_test_001" });
    expect(usages).toHaveLength(1);
    expect(usages[0].status).toBe("pending");
  });

  it("blocks a second checkout while a pending session exists (same email)", () => {
    const usages: PromoUsageRecord[] = [];
    // First checkout
    tryCreateCheckoutSession(usages, "WELCOME10", "buyer@example.com", "cs_test_001");
    // Attempt second checkout before the first session completes
    const result = tryCreateCheckoutSession(
      usages,
      "WELCOME10",
      "buyer@example.com",
      "cs_test_002"
    );
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/already been used/i);
    }
    // Only one record should exist
    expect(usages).toHaveLength(1);
  });

  it("blocks replay after a confirmed (paid) session", () => {
    const usages: PromoUsageRecord[] = [];
    tryCreateCheckoutSession(usages, "WELCOME10", "buyer@example.com", "cs_test_001");
    confirmSession(usages, "cs_test_001");
    expect(usages[0].status).toBe("confirmed");

    const result = tryCreateCheckoutSession(
      usages,
      "WELCOME10",
      "buyer@example.com",
      "cs_test_002"
    );
    expect("error" in result).toBe(true);
  });

  it("releases the lock when a session expires, allowing a retry", () => {
    const usages: PromoUsageRecord[] = [];
    tryCreateCheckoutSession(usages, "WELCOME10", "buyer@example.com", "cs_test_001");
    // Session expires (buyer closed the tab / Stripe 30-min timeout)
    expireSession(usages, "cs_test_001");
    expect(usages).toHaveLength(0);

    // Buyer starts a new checkout — should succeed
    const result = tryCreateCheckoutSession(
      usages,
      "WELCOME10",
      "buyer@example.com",
      "cs_test_002"
    );
    expect(result).toEqual({ sessionId: "cs_test_002" });
    expect(usages).toHaveLength(1);
    expect(usages[0].stripeSessionId).toBe("cs_test_002");
  });

  it("allows a different email to use the same one-time code", () => {
    const usages: PromoUsageRecord[] = [];
    tryCreateCheckoutSession(usages, "WELCOME10", "buyer1@example.com", "cs_test_001");
    confirmSession(usages, "cs_test_001");

    const result = tryCreateCheckoutSession(
      usages,
      "WELCOME10",
      "buyer2@example.com",
      "cs_test_002"
    );
    expect(result).toEqual({ sessionId: "cs_test_002" });
  });

  it("never blocks GOOGLETEST (unlimited code)", () => {
    const usages: PromoUsageRecord[] = [];
    // Use it three times in a row with the same email
    for (let i = 1; i <= 3; i++) {
      const result = tryCreateCheckoutSession(
        usages,
        "GOOGLETEST",
        "buyer@example.com",
        `cs_test_00${i}`
      );
      expect("sessionId" in result).toBe(true);
    }
    // No records inserted for unlimited codes
    expect(usages).toHaveLength(0);
  });

  it("isCodeBlocked returns false when only a released (deleted) record remains", () => {
    const usages: PromoUsageRecord[] = [];
    tryCreateCheckoutSession(usages, "WELCOME10", "buyer@example.com", "cs_test_001");
    expireSession(usages, "cs_test_001");
    expect(isCodeBlocked(usages, "WELCOME10", "buyer@example.com")).toBe(false);
  });

  it("isCodeBlocked returns true for a pending record", () => {
    const usages: PromoUsageRecord[] = [];
    tryCreateCheckoutSession(usages, "WELCOME10", "buyer@example.com", "cs_test_001");
    expect(isCodeBlocked(usages, "WELCOME10", "buyer@example.com")).toBe(true);
  });

  it("isCodeBlocked returns true for a confirmed record", () => {
    const usages: PromoUsageRecord[] = [];
    tryCreateCheckoutSession(usages, "WELCOME10", "buyer@example.com", "cs_test_001");
    confirmSession(usages, "cs_test_001");
    expect(isCodeBlocked(usages, "WELCOME10", "buyer@example.com")).toBe(true);
  });
});
