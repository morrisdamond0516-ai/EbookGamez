import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Mock heavy dependencies before importing the module under test.
// ---------------------------------------------------------------------------

const mockCreateOrder = vi.fn();
const mockGetOrderBySessionId = vi.fn();
const mockAddOrderItems = vi.fn();
const mockGetBookById = vi.fn();

vi.mock("./storage", () => ({
  storage: {
    createOrder: (...args: any[]) => mockCreateOrder(...args),
    getOrderBySessionId: (...args: any[]) => mockGetOrderBySessionId(...args),
    addOrderItems: (...args: any[]) => mockAddOrderItems(...args),
    getBookById: (...args: any[]) => mockGetBookById(...args),
  },
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock("./emailService", () => ({
  sendPurchaseThankYouEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./ga4", () => ({
  sendGA4PurchaseEvent: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are declared.
// ---------------------------------------------------------------------------
import { createOrderFromStripeSession } from "./checkoutHandler";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 999, // $9.99 in cents — post-discount Stripe-confirmed total
    customer_details: { email: "buyer@example.com" } as any,
    metadata: {
      bookIds: "42",
      purchaseTypes: "download",
      total: "15.00", // pre-discount sum that must NOT be stored
    },
    payment_intent: "pi_test_456",
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

const FAKE_BOOK = {
  id: 42,
  title: "Test Book",
  price: "15.00",
  genre: "Fiction",
};

const FAKE_ORDER = { id: 1, customerEmail: "buyer@example.com", total: "9.99" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createOrderFromStripeSession — total field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrderBySessionId.mockResolvedValue(undefined); // no duplicate
    mockCreateOrder.mockResolvedValue(FAKE_ORDER);
    mockAddOrderItems.mockResolvedValue([]);
    mockGetBookById.mockResolvedValue(FAKE_BOOK);
  });

  it("stores amount_total / 100 as orders.total (post-discount Stripe value)", async () => {
    const session = makeSession({ amount_total: 999 }); // $9.99 after coupon

    await createOrderFromStripeSession(session.id, session);

    expect(mockCreateOrder).toHaveBeenCalledOnce();
    const createArgs = mockCreateOrder.mock.calls[0][0];
    expect(createArgs.total).toBe("9.99");
  });

  it("does NOT store the pre-discount metadata.total value", async () => {
    // metadata.total says 15.00 (no coupon applied), but Stripe charged 9.99
    const session = makeSession({ amount_total: 999 });

    await createOrderFromStripeSession(session.id, session);

    const createArgs = mockCreateOrder.mock.calls[0][0];
    expect(createArgs.total).not.toBe("15.00");
  });

  it("falls back to metadata.total when amount_total is null", async () => {
    const session = makeSession({ amount_total: null as any });

    await createOrderFromStripeSession(session.id, session);

    const createArgs = mockCreateOrder.mock.calls[0][0];
    expect(createArgs.total).toBe("15.00");
  });

  it("uses '0' as a last-resort fallback when both amount_total and metadata.total are absent", async () => {
    const session = makeSession({ amount_total: null as any });
    (session as any).metadata = { bookIds: "42", purchaseTypes: "download" }; // no total key

    await createOrderFromStripeSession(session.id, session);

    const createArgs = mockCreateOrder.mock.calls[0][0];
    expect(createArgs.total).toBe("0");
  });

  it("skips order creation when the session was already processed (idempotency)", async () => {
    mockGetOrderBySessionId.mockResolvedValue(FAKE_ORDER); // duplicate found

    await createOrderFromStripeSession("cs_test_123", makeSession());

    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("skips order creation when payment_status is not paid", async () => {
    const session = makeSession({ payment_status: "unpaid" });

    await createOrderFromStripeSession(session.id, session);

    expect(mockCreateOrder).not.toHaveBeenCalled();
  });
});
