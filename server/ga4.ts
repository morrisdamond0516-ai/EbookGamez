/**
 * GA4 Measurement Protocol — server-side event sender.
 *
 * Sends purchase events directly to GA4 from the Stripe webhook so conversions
 * are captured even when a buyer closes the tab before the success page loads.
 *
 * Requires env vars:
 *   GA4_MEASUREMENT_ID  — e.g. G-86TGGPV1F3  (already set)
 *   GA4_API_SECRET      — create in GA4 Admin → Data Streams → Measurement Protocol API secrets
 */

const GA4_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const GA4_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";

function pseudoClientId(customerEmail: string, sessionId: string): string {
  let hash = 0;
  const str = customerEmail + sessionId;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `server.${Math.abs(hash)}`;
}

function cleanTitle(title: string): string {
  return title
    .replace(" (Digital Download)", "")
    .replace(" (1-Year Online Reading)", "")
    .replace(" (Read Online + Download)", "")
    .replace(" (Online Reading)", "")
    .replace(" (Read + Download)", "")
    .trim();
}

export interface GA4PurchaseItem {
  bookId: number;
  title: string;
  price: string;
  genre?: string;
  purchaseType?: string;
}

export async function sendGA4PurchaseEvent(data: {
  orderId: number;
  sessionId: string;
  customerEmail: string;
  total: string;
  coupon?: string;
  items: GA4PurchaseItem[];
}): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    console.log("[GA4] Skipping server-side purchase event — GA4_MEASUREMENT_ID or GA4_API_SECRET not set");
    return;
  }

  const endpoint = process.env.NODE_ENV === "development" ? GA4_DEBUG_ENDPOINT : GA4_ENDPOINT;
  const url = `${endpoint}?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  const payload = {
    client_id: pseudoClientId(data.customerEmail, data.sessionId),
    user_id: data.customerEmail !== "unknown@email.com" ? data.customerEmail : undefined,
    non_personalized_ads: false,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: String(data.orderId),
          value: parseFloat(data.total) || 0,
          currency: "USD",
          coupon: data.coupon || undefined,
          source: "server",
          session_id: data.sessionId,
          items: data.items.map((item) => ({
            item_id: String(item.bookId),
            item_name: cleanTitle(item.title),
            item_brand: "EbookGamez",
            item_category: item.genre || "Ebook",
            item_variant: item.purchaseType || "download",
            price: parseFloat(item.price) || 0,
            quantity: 1,
          })),
        },
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (process.env.NODE_ENV === "development") {
      const body = await res.json().catch(() => ({}));
      const issues = (body as any)?.validationMessages ?? [];
      if (issues.length > 0) {
        console.warn("[GA4] Validation issues:", JSON.stringify(issues, null, 2));
      } else {
        console.log(`[GA4] Debug purchase event validated OK for order #${data.orderId}`);
      }
    } else {
      if (res.ok || res.status === 204) {
        console.log(`[GA4] Server-side purchase event sent for order #${data.orderId} ($${data.total})`);
      } else {
        console.warn(`[GA4] Unexpected response ${res.status} for order #${data.orderId}`);
      }
    }
  } catch (err: any) {
    console.error(`[GA4] Failed to send server-side purchase event: ${err.message}`);
  }
}
