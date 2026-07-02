declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

function push(event: Record<string, unknown>) {
  window.dataLayer = window.dataLayer || [];
  if (import.meta.env.DEV) {
    window.dataLayer.push({ ...event, debug_mode: true });
    console.log(
      `[Analytics] debug_mode active — event sent to GA4 DebugView: ${String(event.event)}`
    );
  } else {
    window.dataLayer.push(event);
  }
}

export function trackViewItem(book: {
  id: number;
  title: string;
  author: string;
  price: string;
  genre?: string;
}) {
  push({
    event: "view_item",
    ecommerce: {
      currency: "USD",
      value: parseFloat(book.price) || 0,
      items: [
        {
          item_id: String(book.id),
          item_name: book.title,
          item_brand: book.author,
          item_category: book.genre || "Ebook",
          price: parseFloat(book.price) || 0,
          quantity: 1,
        },
      ],
    },
  });
}

export function trackBeginCheckout(
  items: Array<{
    id: number;
    title: string;
    price: number;
    purchaseType?: string;
  }>,
  value: number
) {
  push({
    event: "begin_checkout",
    ecommerce: {
      currency: "USD",
      value,
      items: items.map((item) => ({
        item_id: String(item.id),
        item_name: item.title,
        item_variant: item.purchaseType || "download",
        price: item.price,
        quantity: 1,
      })),
    },
  });
}

export function trackPurchase(order: {
  id: number;
  total: string;
  customerEmail: string;
  items: Array<{
    id: number;
    title: string;
    price: string;
    bookId: number;
    purchaseType?: string;
  }>;
}) {
  push({
    event: "purchase",
    ecommerce: {
      transaction_id: String(order.id),
      currency: "USD",
      value: parseFloat(order.total) || 0,
      items: order.items.map((item) => ({
        item_id: String(item.bookId),
        item_name: item.title,
        item_variant: item.purchaseType || "download",
        price: parseFloat(item.price) || 0,
        quantity: 1,
      })),
    },
  });
}

export function trackPageView(path: string) {
  push({
    event: "page_view",
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackAddToCart(item: {
  id: number;
  title: string;
  price: number;
  purchaseType?: string;
  genre?: string;
}) {
  push({
    event: "add_to_cart",
    ecommerce: {
      currency: "USD",
      value: item.price,
      items: [
        {
          item_id: String(item.id),
          item_name: item.title,
          item_category: item.genre || "Ebook",
          item_variant: item.purchaseType || "download",
          price: item.price,
          quantity: 1,
        },
      ],
    },
  });
}

export function trackSignUp(method: string = "email") {
  push({
    event: "sign_up",
    method,
  });
}

export function trackSubscriptionBeginCheckout(plan: {
  name: string;
  tier: string;
  price: number;
  billingInterval: string;
}) {
  push({
    event: "begin_checkout",
    ecommerce: {
      currency: "USD",
      value: plan.price,
      items: [
        {
          item_id: `subscription_${plan.tier}_${plan.billingInterval}`,
          item_name: `${plan.name} Pass`,
          item_category: "Reading Pass",
          item_variant: plan.billingInterval,
          price: plan.price,
          quantity: 1,
        },
      ],
    },
  });
}

export function trackSubscriptionPurchase(data: {
  sessionId: string;
  planName: string;
  tier: string;
  value: number;
  billingInterval: string;
}) {
  push({
    event: "purchase",
    ecommerce: {
      transaction_id: data.sessionId,
      currency: "USD",
      value: data.value,
      items: [
        {
          item_id: `subscription_${data.tier}_${data.billingInterval}`,
          item_name: `${data.planName} Pass`,
          item_category: "Reading Pass",
          item_variant: data.billingInterval,
          price: data.value,
          quantity: 1,
        },
      ],
    },
  });
}

const firedBillingIntervalSwitches = new Set<string>();

export function trackBillingIntervalSwitch(data: {
  planName: string;
  tier: string;
  fromInterval: "monthly" | "annual";
  toInterval: "monthly" | "annual";
  oldPrice: number;
  newPrice: number;
  annualSavings: number;
}) {
  const windowKey = Math.floor(Date.now() / 5000);
  const dedupeKey = `${data.tier}:${data.fromInterval}→${data.toInterval}:${windowKey}`;
  if (firedBillingIntervalSwitches.has(dedupeKey)) return;
  firedBillingIntervalSwitches.add(dedupeKey);

  const intervalSwitchPayload = {
    plan_name: data.planName,
    plan_tier: data.tier,
    from_interval: data.fromInterval,
    to_interval: data.toInterval,
    old_price: data.oldPrice,
    new_price: data.newPrice,
    annual_savings: data.annualSavings,
    ecommerce: {
      currency: "USD",
      value: data.newPrice,
      items: [
        {
          item_id: `subscription_${data.tier}_${data.toInterval}`,
          item_name: `${data.planName} Pass`,
          item_category: "Reading Pass",
          item_variant: data.toInterval,
          price: data.newPrice,
          quantity: 1,
        },
      ],
    },
  };

  push({ event: "billing_interval_switch", ...intervalSwitchPayload });

  // Fire a dedicated event for switches to annual so it can be registered as a
  // GA4 conversion without needing a UI-level parameter filter. GA4's Admin API
  // marks whole event names as conversions; a separate event is the only way to
  // isolate the high-value annual switch as a distinct conversion goal via the API.
  if (data.toInterval === "annual") {
    push({ event: "billing_interval_to_annual", ...intervalSwitchPayload });
  }
}

const firedSubscriptionChanges = new Set<string>();

export function trackSubscriptionChange(data: {
  previousPlan: string;
  previousTier: string;
  newPlan: string;
  newTier: string;
  priceDelta: number;
  newPrice: number;
  billingInterval: string;
  action: "upgrade" | "downgrade";
}) {
  const windowKey = Math.floor(Date.now() / 5000);
  const dedupeKey = `${data.previousTier}→${data.newTier}:${data.billingInterval}:${data.action}:${windowKey}`;
  if (firedSubscriptionChanges.has(dedupeKey)) return;
  firedSubscriptionChanges.add(dedupeKey);

  const ecommerce = {
    currency: "USD",
    value: data.newPrice,
    items: [
      {
        item_id: `subscription_${data.newTier}_${data.billingInterval}`,
        item_name: `${data.newPlan} Pass`,
        item_category: "Reading Pass",
        item_variant: data.billingInterval,
        price: data.newPrice,
        quantity: 1,
      },
    ],
  };

  push({
    event: "subscription_change",
    subscription_action: data.action,
    previous_plan: data.previousPlan,
    previous_tier: data.previousTier,
    new_plan: data.newPlan,
    new_tier: data.newTier,
    price_delta: data.priceDelta,
    ecommerce,
  });

  // Fire a dedicated event for upgrades so it can be registered as a GA4
  // conversion without needing a UI-level parameter filter. GA4's Admin API
  // marks whole event names as conversions; a separate event is the only way
  // to isolate upgrades as a distinct conversion goal via the API.
  if (data.action === "upgrade") {
    push({
      event: "subscription_upgrade",
      previous_plan: data.previousPlan,
      previous_tier: data.previousTier,
      new_plan: data.newPlan,
      new_tier: data.newTier,
      price_delta: data.priceDelta,
      ecommerce,
    });
  }
}
