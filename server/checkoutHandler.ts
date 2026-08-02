import { storage, db } from "./storage";
import { readingAccess, promoUsages } from "@shared/schema";
import type { InsertOrderItem } from "@shared/schema";
import { sql } from "drizzle-orm";
import { sendPurchaseThankYouEmail } from "./emailService";
import { sendGA4PurchaseEvent } from "./ga4";
import type Stripe from "stripe";

export async function createOrderFromStripeSession(
  sessionId: string,
  session: Stripe.Checkout.Session
): Promise<void> {
  const existing = await storage.getOrderBySessionId(sessionId);
  if (existing) return;

  if (session.payment_status !== "paid") return;

  const bookIdsStr = session.metadata?.bookIds || "";
  const bookIds = bookIdsStr
    .split(",")
    .filter((id: string) => id)
    .map((id: string) => parseInt(id));
  // Use the Stripe-confirmed post-discount total (amount_total is in cents).
  // Falling back to metadata.total would record the pre-discount line-item sum
  // and cause logged-in conversion events to over-report.
  const total =
    session.amount_total != null
      ? (session.amount_total / 100).toFixed(2)
      : session.metadata?.total || "0";
  const customerEmail =
    session.customer_details?.email || "unknown@email.com";

  const order = await storage.createOrder({
    customerEmail,
    stripeSessionId: sessionId,
    stripePaymentIntentId: session.payment_intent as string,
    status: "completed",
    total,
  });

  if (bookIds.length > 0) {
    const purchaseTypesStr = session.metadata?.purchaseTypes || "";
    const purchaseTypesList = purchaseTypesStr.split(",");
    const booksForOrder = await Promise.all(
      bookIds.map((id: number) => storage.getBookById(id))
    );
    const orderItemsData: InsertOrderItem[] = booksForOrder
      .filter((book) => book !== undefined)
      .map((book, idx) => {
        const fullPrice = parseFloat(book!.price);
        const pType = purchaseTypesList[idx] || "download";
        let chargedPrice = fullPrice;
        let titleSuffix = "";
        const bGenre = (book!.genre || "").toLowerCase();
        const isVis = ["coloring", "art book"].some((v) =>
          bGenre.includes(v)
        );
        if (pType === "read_online") {
          if (isVis) {
            chargedPrice = Math.max(1.99, fullPrice - 1);
          } else {
            const disc = Math.round(fullPrice * 0.65 * 100) / 100;
            const c = Math.round((disc % 1) * 100);
            chargedPrice =
              c >= 75
                ? Math.floor(disc) + 0.99
                : c >= 25
                ? Math.floor(disc) + 0.49
                : Math.floor(disc) - 0.01;
            chargedPrice = Math.max(1.99, chargedPrice);
          }
          titleSuffix = " (Online Reading)";
        } else if (pType === "bundle") {
          const prem = Math.round(fullPrice * 1.3 * 100) / 100;
          const c = Math.round((prem % 1) * 100);
          chargedPrice =
            c >= 75
              ? Math.floor(prem) + 0.99
              : c >= 25
              ? Math.floor(prem) + 0.49
              : Math.floor(prem) - 0.01;
          chargedPrice = Math.max(fullPrice + 1, chargedPrice);
          titleSuffix = " (Read + Download)";
        }
        return {
          orderId: order.id,
          bookId: book!.id,
          price: chargedPrice.toFixed(2),
          title: book!.title + titleSuffix,
          purchaseType: pType,
        };
      });

    await storage.addOrderItems(orderItemsData);

    for (let idx = 0; idx < bookIds.length; idx++) {
      const pType = purchaseTypesList[idx] || "download";
      if (pType === "read_online" || pType === "bundle") {
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        await db.insert(readingAccess).values({
          bookId: bookIds[idx],
          customerEmail,
          stripeSessionId: sessionId,
          expiresAt: oneYearFromNow,
        });
      }
    }

    if (session.metadata?.promoCode) {
      const metaPromoCode = session.metadata.promoCode;
      // Promote the pending lock to confirmed.
      // Match by (customer_email, promo_code) rather than stripeSessionId so the
      // crash window — where the server restarted between INSERT(pending,null) and
      // UPDATE(sessionId) — is handled: the pending row still exists with null sessionId
      // and this WHERE clause finds it correctly.
      const updated = await db
        .update(promoUsages)
        .set({ status: "confirmed", customerEmail, orderTotal: total, stripeSessionId: sessionId })
        .where(
          sql`${promoUsages.customerEmail} = ${customerEmail} AND ${promoUsages.promoCode} = ${metaPromoCode} AND ${promoUsages.status} = 'pending'`
        )
        .returning();
      if (updated.length === 0) {
        // No pending row found at all (e.g. duplicate webhook event after a confirmed row
        // was already written, or a session that bypassed the lock path).
        // Use INSERT ... ON CONFLICT DO UPDATE so a duplicate webhook never raises an error
        // and a genuinely new row is recorded correctly.
        await db.execute(
          sql`INSERT INTO promo_usages (promo_code, customer_email, stripe_session_id, order_total, status)
              VALUES (${metaPromoCode}, ${customerEmail}, ${sessionId}, ${total}, 'confirmed')
              ON CONFLICT (customer_email, promo_code)
              DO UPDATE SET status = 'confirmed', stripe_session_id = ${sessionId}, order_total = ${total}`
        );
      }
    }

    try {
      const firstBook = booksForOrder.find((b) => b);
      if (firstBook && customerEmail !== "unknown@email.com") {
        await sendPurchaseThankYouEmail(customerEmail, firstBook.title, order.id);
      }
    } catch (emailErr: any) {
      console.error(`[Email] Failed to send purchase thank-you:`, emailErr.message);
    }

    sendGA4PurchaseEvent({
      orderId: order.id,
      sessionId,
      customerEmail,
      total,
      coupon: session.metadata?.promoCode || undefined,
      items: orderItemsData.map((oi, idx) => ({
        bookId: oi.bookId,
        title: oi.title,
        price: oi.price,
        genre: booksForOrder[idx]?.genre || "Ebook",
        purchaseType: oi.purchaseType || "download",
      })),
    }).catch((err) => console.error("[GA4] Unhandled error:", err.message));
  }
}
