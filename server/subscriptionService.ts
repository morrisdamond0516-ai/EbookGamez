import { db } from "./storage";
import { subscriptionPlans, subscriptions, subscriptionUsage, subscriptionEvents, activeCheckouts, books } from "@shared/schema";
import { eq, and, gte, lte, lt, desc, sql, count, isNull } from "drizzle-orm";
import { getUncachableStripeClient } from "./stripeClient";

const PLANS_CONFIG = [
  { name: "Lite", tier: "lite", monthlyPrice: "4.99", annualPrice: "49.90", readsPerMonth: 99999, downloadsPerMonth: 1 },
  { name: "Reader", tier: "reader", monthlyPrice: "8.99", annualPrice: "89.90", readsPerMonth: 99999, downloadsPerMonth: 2 },
  { name: "Value", tier: "value", monthlyPrice: "12.99", annualPrice: "129.90", readsPerMonth: 99999, downloadsPerMonth: 3 },
  { name: "Premium", tier: "premium", monthlyPrice: "18.99", annualPrice: "189.90", readsPerMonth: 99999, downloadsPerMonth: 5 },
  { name: "VIP", tier: "vip", monthlyPrice: "25.99", annualPrice: "259.90", readsPerMonth: 99999, downloadsPerMonth: 8 },
];

export const UNLIMITED_READS = 99999;

const TIER_ORDER = ["lite", "reader", "value", "premium", "vip"];

const FREE_TRIAL_TIER = "value";
const FREE_TRIAL_DAYS = 7;

const ROLLOVER_CAP_MULTIPLIER = 1;

export async function initializeSubscriptionPlans() {
  const existing = await db.select().from(subscriptionPlans);
  if (existing.length >= 5) {
    const needsUpdate = existing.some(p => {
      const config = PLANS_CONFIG.find(c => c.tier === p.tier);
      return config && (p.monthlyPrice !== config.monthlyPrice || p.readsPerMonth !== config.readsPerMonth || p.downloadsPerMonth !== config.downloadsPerMonth);
    });
    const needsAnnual = existing.some(p => !p.stripeAnnualPriceId);
    const needsAnnualUpdate = existing.some(p => {
      const config = PLANS_CONFIG.find(c => c.tier === p.tier);
      return config && p.annualPrice !== config.annualPrice;
    });
    if (needsUpdate) {
      console.log("Subscription plans need updating — migrating to new pricing...");
      await migrateSubscriptionPlans(existing);
      return await db.select().from(subscriptionPlans);
    }
    if (needsAnnual) {
      console.log("Adding annual pricing to existing plans...");
      await addAnnualPricing(existing);
      return await db.select().from(subscriptionPlans);
    }
    if (needsAnnualUpdate) {
      console.log("Annual pricing amounts need updating — migrating to 10x monthly pricing...");
      await updateAnnualPricing(existing);
      return await db.select().from(subscriptionPlans);
    }
    console.log("Subscription plans already exist, skipping initialization");
    return existing;
  }

  const stripe = await getUncachableStripeClient();
  const plans = [];

  for (const planConfig of PLANS_CONFIG) {
    const existingPlan = existing.find(p => p.tier === planConfig.tier);
    if (existingPlan) {
      plans.push(existingPlan);
      continue;
    }

    const product = await stripe.products.create({
      name: `EbookGamez ${planConfig.name} Pass`,
      description: `Unlimited online reading${planConfig.downloadsPerMonth > 0 ? `, ${planConfig.downloadsPerMonth} downloads included` : ''}`,
      metadata: { tier: planConfig.tier },
    });

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(parseFloat(planConfig.monthlyPrice) * 100),
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { tier: planConfig.tier },
    });

    const annualPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(parseFloat(planConfig.annualPrice) * 100),
      currency: "usd",
      recurring: { interval: "year" },
      metadata: { tier: planConfig.tier, billing: "annual" },
    });

    const [plan] = await db.insert(subscriptionPlans).values({
      name: planConfig.name,
      tier: planConfig.tier,
      monthlyPrice: planConfig.monthlyPrice,
      annualPrice: planConfig.annualPrice,
      readsPerMonth: planConfig.readsPerMonth,
      downloadsPerMonth: planConfig.downloadsPerMonth,
      stripePriceId: monthlyPrice.id,
      stripeAnnualPriceId: annualPrice.id,
      stripeProductId: product.id,
      isActive: true,
    }).returning();

    plans.push(plan);
    console.log(`Created subscription plan: ${planConfig.name} ($${planConfig.monthlyPrice}/mo, $${planConfig.annualPrice}/yr)`);
  }

  return plans;
}

async function addAnnualPricing(existing: any[]) {
  const stripe = await getUncachableStripeClient();

  for (const planConfig of PLANS_CONFIG) {
    const existingPlan = existing.find(p => p.tier === planConfig.tier);
    if (!existingPlan || existingPlan.stripeAnnualPriceId) continue;

    const annualPrice = await stripe.prices.create({
      product: existingPlan.stripeProductId,
      unit_amount: Math.round(parseFloat(planConfig.annualPrice) * 100),
      currency: "usd",
      recurring: { interval: "year" },
      metadata: { tier: planConfig.tier, billing: "annual" },
    });

    await db.update(subscriptionPlans)
      .set({
        annualPrice: planConfig.annualPrice,
        stripeAnnualPriceId: annualPrice.id,
      })
      .where(eq(subscriptionPlans.id, existingPlan.id));

    console.log(`Added annual pricing for ${planConfig.name}: $${planConfig.annualPrice}/yr`);
  }
}

async function updateAnnualPricing(existing: any[]) {
  const stripe = await getUncachableStripeClient();

  for (const planConfig of PLANS_CONFIG) {
    const existingPlan = existing.find(p => p.tier === planConfig.tier);
    if (!existingPlan) continue;
    if (existingPlan.annualPrice === planConfig.annualPrice) continue;

    const newAnnualPrice = await stripe.prices.create({
      product: existingPlan.stripeProductId,
      unit_amount: Math.round(parseFloat(planConfig.annualPrice) * 100),
      currency: "usd",
      recurring: { interval: "year" },
      metadata: { tier: planConfig.tier, billing: "annual" },
    });

    if (existingPlan.stripeAnnualPriceId) {
      try {
        await stripe.prices.update(existingPlan.stripeAnnualPriceId, { active: false });
      } catch (err: any) {
        console.warn(`Could not deactivate old annual price ${existingPlan.stripeAnnualPriceId}: ${err.message}`);
      }
    }

    await db.update(subscriptionPlans)
      .set({
        annualPrice: planConfig.annualPrice,
        stripeAnnualPriceId: newAnnualPrice.id,
      })
      .where(eq(subscriptionPlans.id, existingPlan.id));

    console.log(`Updated annual pricing for ${planConfig.name}: $${existingPlan.annualPrice}/yr → $${planConfig.annualPrice}/yr (10x monthly)`);
  }
}

async function migrateSubscriptionPlans(existing: any[]) {
  const stripe = await getUncachableStripeClient();

  for (const planConfig of PLANS_CONFIG) {
    const existingPlan = existing.find(p => p.tier === planConfig.tier);
    if (!existingPlan) continue;

    const priceChanged = existingPlan.monthlyPrice !== planConfig.monthlyPrice;

    let newPriceId = existingPlan.stripePriceId;
    if (priceChanged) {
      const newPrice = await stripe.prices.create({
        product: existingPlan.stripeProductId,
        unit_amount: Math.round(parseFloat(planConfig.monthlyPrice) * 100),
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { tier: planConfig.tier },
      });
      newPriceId = newPrice.id;

      if (existingPlan.stripePriceId) {
        await stripe.prices.update(existingPlan.stripePriceId, { active: false });
      }
    }

    await stripe.products.update(existingPlan.stripeProductId, {
      description: `Unlimited online reading, ${planConfig.downloadsPerMonth} downloads included to keep forever`,
    });

    await db.update(subscriptionPlans)
      .set({
        monthlyPrice: planConfig.monthlyPrice,
        readsPerMonth: planConfig.readsPerMonth,
        downloadsPerMonth: planConfig.downloadsPerMonth,
        stripePriceId: newPriceId,
      })
      .where(eq(subscriptionPlans.id, existingPlan.id));

    console.log(`Migrated plan: ${planConfig.name} → $${planConfig.monthlyPrice}/mo, unlimited reads, ${planConfig.downloadsPerMonth} downloads`);
  }
}

export async function getPlans() {
  return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true)).orderBy(subscriptionPlans.monthlyPrice);
}

export async function getPlanById(id: number) {
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  return plan;
}

export async function createSubscriptionCheckout(planId: number, customerEmail: string, baseUrl: string, billingInterval: "monthly" | "annual" = "monthly", promoCode: string | null = null) {
  const plan = await getPlanById(planId);
  if (!plan || !plan.stripePriceId) throw new Error("Plan not found or not configured");

  const stripe = await getUncachableStripeClient();

  const existingSub = await getActiveSubscription(customerEmail);
  if (existingSub) throw new Error("You already have an active subscription. Please cancel first or manage your current plan.");

  const priceId = billingInterval === "annual" && plan.stripeAnnualPriceId
    ? plan.stripeAnnualPriceId
    : plan.stripePriceId;

  const isTrialEligible = plan.tier === FREE_TRIAL_TIER && billingInterval === "monthly";
  let hasUsedTrial = false;
  if (isTrialEligible) {
    const pastSubs = await db.select().from(subscriptions)
      .where(eq(subscriptions.customerEmail, customerEmail));
    hasUsedTrial = pastSubs.length > 0;
  }

  // Resolve owner test coupon (100% off first payment only)
  const OWNER_CODE_EXPIRY = new Date("2026-06-19T23:59:59Z");
  let ownerCouponId: string | null = null;
  if (promoCode && promoCode.toUpperCase().trim() === "EBGZOWNER" && new Date() <= OWNER_CODE_EXPIRY) {
    const COUPON_ID = "EBGZOWNER_100PCT_ONCE";
    try {
      await stripe.coupons.retrieve(COUPON_ID);
      ownerCouponId = COUPON_ID;
    } catch {
      const coupon = await stripe.coupons.create({ id: COUPON_ID, percent_off: 100, duration: "once", name: "Owner Test — 100% off first payment" });
      ownerCouponId = coupon.id;
    }
  }

  const sessionParams: any = {
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}&tier=${plan.tier}&billing=${billingInterval}`,
    cancel_url: `${baseUrl}/subscription`,
    expires_at: Math.floor(Date.now() / 1000) + 1800,
    // Tag every EbookGamez subscription so it's identifiable in Stripe
    // even when the Stripe account is shared with other businesses.
    metadata: {
      site: 'ebookgamez.com',
      business: 'EbookGamez',
      planId: plan.id.toString(),
      tier: plan.tier,
      billingInterval,
    },
    subscription_data: {
      description: `EbookGamez Reading Pass — ${plan.tier} tier`,
      metadata: { site: 'ebookgamez.com', business: 'EbookGamez', planId: plan.id.toString(), tier: plan.tier, billingInterval },
    },
  };

  if (ownerCouponId) {
    // discounts and allow_promotion_codes are mutually exclusive in Stripe
    sessionParams.discounts = [{ coupon: ownerCouponId }];
  } else {
    sessionParams.after_expiration = { recovery: { enabled: true, allow_promotion_codes: true } };
  }

  if (isTrialEligible && !hasUsedTrial) {
    sessionParams.subscription_data = {
      trial_period_days: FREE_TRIAL_DAYS,
      metadata: { planId: plan.id.toString(), tier: plan.tier, billingInterval, trial: "true" },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  await trackEvent("checkout_started", customerEmail, plan.id);
  return session;
}

export async function handleSubscriptionCreated(stripeSubscription: any) {
  const customerId = stripeSubscription.customer;
  const stripe = await getUncachableStripeClient();
  const customer = await stripe.customers.retrieve(customerId);
  const email = (customer as any).email || "unknown@email.com";

  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
  let [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.stripePriceId, priceId));
  let billingInterval: "monthly" | "annual" = "monthly";

  if (!plan) {
    [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.stripeAnnualPriceId, priceId));
    if (plan) billingInterval = "annual";
  }

  if (!plan) {
    console.error("No plan found for price:", priceId);
    return;
  }

  const existing = await getActiveSubscription(email);
  if (existing) {
    await db.update(subscriptions).set({
      planId: plan.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: customerId,
      status: "active",
      billingInterval,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelledAt: null,
    }).where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      customerEmail: email,
      planId: plan.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: customerId,
      status: "active",
      billingInterval,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    });
  }

  await trackEvent("subscription_created", email, plan.id);
}

export async function handleSubscriptionUpdated(stripeSubscription: any) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id));
  if (!sub) return;

  const status = stripeSubscription.status === "active" ? "active" :
    stripeSubscription.status === "canceled" ? "cancelled" :
    stripeSubscription.status === "past_due" ? "past_due" : stripeSubscription.status;

  const priceId = stripeSubscription.items?.data?.[0]?.price?.id;
  let billingInterval = sub.billingInterval;
  let planId = sub.planId;
  if (priceId) {
    const [matchedMonthly] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.stripePriceId, priceId));
    if (matchedMonthly) {
      billingInterval = "monthly";
      planId = matchedMonthly.id;
    } else {
      const [matchedAnnual] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.stripeAnnualPriceId, priceId));
      if (matchedAnnual) {
        billingInterval = "annual";
        planId = matchedAnnual.id;
      }
    }
  }

  const newPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
  const periodChanged = sub.currentPeriodStart && newPeriodStart.getTime() !== sub.currentPeriodStart.getTime();

  let rolloverCredits = sub.rolloverCredits;
  if (periodChanged && status === "active" && sub.currentPeriodStart && sub.currentPeriodEnd) {
    const plan = await getPlanById(sub.planId);
    if (plan) {
      const downloadsUsed = await getDownloadsForSubscriptionPeriod(sub.id, sub.currentPeriodStart, sub.currentPeriodEnd);
      const totalAvailable = plan.downloadsPerMonth + sub.rolloverCredits;
      const unused = Math.max(0, totalAvailable - downloadsUsed);
      const cap = plan.downloadsPerMonth * ROLLOVER_CAP_MULTIPLIER;
      rolloverCredits = Math.min(unused, cap);
      console.log(`Rollover for ${sub.customerEmail}: ${unused} unused credits, capped to ${rolloverCredits}`);
    }
  }

  await db.update(subscriptions).set({
    status,
    planId,
    billingInterval,
    currentPeriodStart: newPeriodStart,
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
    rolloverCredits,
  }).where(eq(subscriptions.id, sub.id));

  if (status === "cancelled") {
    await trackEvent("subscription_cancelled", sub.customerEmail, sub.planId, sub.id);
  }
}

export async function handleSubscriptionDeleted(stripeSubscription: any) {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscription.id));
  if (!sub) return;

  await db.update(subscriptions).set({
    status: "cancelled",
    cancelledAt: new Date(),
  }).where(eq(subscriptions.id, sub.id));

  await trackEvent("subscription_ended", sub.customerEmail, sub.planId, sub.id);
}

export async function getActiveSubscription(email: string) {
  const [sub] = await db.select().from(subscriptions)
    .where(and(
      eq(subscriptions.customerEmail, email),
      eq(subscriptions.status, "active")
    ))
    .limit(1);
  return sub;
}

export async function getSubscriptionWithPlan(email: string) {
  const sub = await getActiveSubscription(email);
  if (!sub) return null;
  const plan = await getPlanById(sub.planId);
  return { subscription: sub, plan };
}

export async function switchPlanTier(email: string, targetPlanId: number) {
  const subData = await getSubscriptionWithPlan(email);
  if (!subData) throw new Error("No active subscription found");

  const { subscription: sub, plan: currentPlan } = subData;
  if (!sub.stripeSubscriptionId) throw new Error("Subscription is not linked to Stripe");
  if (sub.cancelledAt) throw new Error("Cannot change plan on a subscription that is being cancelled");
  if (sub.planId === targetPlanId) throw new Error("You are already on this plan");

  const targetPlan = await getPlanById(targetPlanId);
  if (!targetPlan) throw new Error("Target plan not found");

  const newPriceId = sub.billingInterval === "annual"
    ? targetPlan.stripeAnnualPriceId
    : targetPlan.stripePriceId;
  if (!newPriceId) throw new Error(`${sub.billingInterval === "annual" ? "Annual" : "Monthly"} price is not configured for the target plan`);

  const stripe = await getUncachableStripeClient();
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const itemId = stripeSub.items?.data?.[0]?.id;
  if (!itemId) throw new Error("Could not locate subscription item to update");

  const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: "create_prorations",
    payment_behavior: "allow_incomplete",
  });

  await db.update(subscriptions).set({
    planId: targetPlanId,
    currentPeriodStart: new Date((updated as any).current_period_start * 1000),
    currentPeriodEnd: new Date((updated as any).current_period_end * 1000),
  }).where(eq(subscriptions.id, sub.id));

  const direction = TIER_ORDER.indexOf(targetPlan.tier) > TIER_ORDER.indexOf(currentPlan.tier) ? "upgraded" : "downgraded";
  await trackEvent(`subscription_${direction}_tier`, email, targetPlanId, sub.id, JSON.stringify({ fromTier: currentPlan.tier, toTier: targetPlan.tier }));

  return { success: true, planId: targetPlanId, tier: targetPlan.tier, planName: targetPlan.name, currentPeriodEnd: new Date((updated as any).current_period_end * 1000) };
}

export async function switchBillingInterval(email: string, targetInterval: "monthly" | "annual") {
  const subData = await getSubscriptionWithPlan(email);
  if (!subData) throw new Error("No active subscription found");

  const { subscription: sub, plan } = subData;
  if (!sub.stripeSubscriptionId) throw new Error("Subscription is not linked to Stripe");
  if (sub.cancelledAt) throw new Error("Cannot switch billing interval on a subscription that is being cancelled");
  if (sub.billingInterval === targetInterval) {
    throw new Error(`You're already on ${targetInterval} billing`);
  }

  const newPriceId = targetInterval === "annual" ? plan.stripeAnnualPriceId : plan.stripePriceId;
  if (!newPriceId) throw new Error(`${targetInterval === "annual" ? "Annual" : "Monthly"} price is not configured for this plan`);

  const stripe = await getUncachableStripeClient();
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const itemId = stripeSub.items?.data?.[0]?.id;
  if (!itemId) throw new Error("Could not locate subscription item to update");

  const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: "create_prorations",
    payment_behavior: "allow_incomplete",
  });

  await db.update(subscriptions).set({
    billingInterval: targetInterval,
    currentPeriodStart: new Date((updated as any).current_period_start * 1000),
    currentPeriodEnd: new Date((updated as any).current_period_end * 1000),
  }).where(eq(subscriptions.id, sub.id));

  await trackEvent(`subscription_switched_to_${targetInterval}`, email, plan.id, sub.id);

  return { success: true, billingInterval: targetInterval, currentPeriodEnd: new Date((updated as any).current_period_end * 1000) };
}

export async function cancelSubscription(email: string) {
  const sub = await getActiveSubscription(email);
  if (!sub || !sub.stripeSubscriptionId) throw new Error("No active subscription found");

  const stripe = await getUncachableStripeClient();
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await db.update(subscriptions).set({ cancelledAt: new Date() }).where(eq(subscriptions.id, sub.id));
  await trackEvent("subscription_cancel_requested", email, sub.planId, sub.id);
  return sub;
}

export async function getUsageForCurrentPeriod(subscriptionId: number, periodStart: Date, periodEnd: Date) {
  const usage = await db.select().from(subscriptionUsage)
    .where(and(
      eq(subscriptionUsage.subscriptionId, subscriptionId),
      gte(subscriptionUsage.createdAt, periodStart),
      lte(subscriptionUsage.createdAt, periodEnd)
    ));

  const reads = usage.filter(u => u.usageType === "read").length;
  const downloads = usage.filter(u => u.usageType === "download").length;
  return { reads, downloads, details: usage };
}

export async function recordUsage(subscriptionId: number, bookId: number, usageType: "read" | "download", periodStart: Date, periodEnd: Date) {
  const existing = await db.select().from(subscriptionUsage)
    .where(and(
      eq(subscriptionUsage.subscriptionId, subscriptionId),
      eq(subscriptionUsage.bookId, bookId),
      eq(subscriptionUsage.usageType, usageType),
      gte(subscriptionUsage.createdAt, periodStart),
      lte(subscriptionUsage.createdAt, periodEnd)
    ));

  if (existing.length > 0) return { alreadyUsed: true };

  const [record] = await db.insert(subscriptionUsage).values({
    subscriptionId,
    bookId,
    usageType,
    periodStart,
    periodEnd,
  }).returning();

  return { alreadyUsed: false, record };
}

export async function getDownloadsForSubscriptionPeriod(subscriptionId: number, periodStart: Date, periodEnd: Date): Promise<number> {
  const usage = await db.select().from(subscriptionUsage)
    .where(and(
      eq(subscriptionUsage.subscriptionId, subscriptionId),
      eq(subscriptionUsage.usageType, "download"),
      gte(subscriptionUsage.createdAt, periodStart),
      lt(subscriptionUsage.createdAt, periodEnd)
    ));
  return usage.length;
}

export function getMonthlyWindow(sub: any): { start: Date; end: Date } {
  const periodStart = new Date(sub.currentPeriodStart);
  const periodEnd = new Date(sub.currentPeriodEnd);

  if (sub.billingInterval !== "annual") {
    return { start: periodStart, end: periodEnd };
  }

  const now = new Date();
  const monthsSinceStart = Math.floor((now.getTime() - periodStart.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
  const windowStart = new Date(periodStart.getTime() + monthsSinceStart * 30.44 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(windowStart.getTime() + 30.44 * 24 * 60 * 60 * 1000);

  if (windowEnd > periodEnd) {
    return { start: windowStart, end: periodEnd };
  }
  return { start: windowStart, end: windowEnd };
}

export async function checkAndRecordUsage(email: string, bookId: number, usageType: "read" | "download") {
  const subData = await getSubscriptionWithPlan(email);
  if (!subData) return { allowed: false, reason: "No active subscription" };

  const { subscription: sub, plan } = subData;
  if (!sub.currentPeriodStart || !sub.currentPeriodEnd) return { allowed: false, reason: "Invalid subscription period" };

  const { start: windowStart, end: windowEnd } = getMonthlyWindow(sub);

  const usage = await getUsageForCurrentPeriod(sub.id, windowStart, windowEnd);

  const baseLimit = usageType === "read" ? plan.readsPerMonth : plan.downloadsPerMonth;
  const rolloverBonus = usageType === "download" ? sub.rolloverCredits : 0;
  const totalLimit = baseLimit + rolloverBonus;
  const isUnlimited = baseLimit >= UNLIMITED_READS;

  if (usageType === "download") {
    const existingCheck = await db.select().from(subscriptionUsage)
      .where(and(
        eq(subscriptionUsage.subscriptionId, sub.id),
        eq(subscriptionUsage.bookId, bookId),
        eq(subscriptionUsage.usageType, "download"),
        gte(subscriptionUsage.createdAt, windowStart),
        lte(subscriptionUsage.createdAt, windowEnd)
      ));
    if (existingCheck.length > 0) {
      return { allowed: true, reason: "Already accessed this book" };
    }

    const periodDownloads = await getDownloadsForSubscriptionPeriod(sub.id, windowStart, windowEnd);
    if (periodDownloads >= totalLimit) {
      return { allowed: false, reason: `You've used all ${totalLimit} of your download slots for this billing period${rolloverBonus > 0 ? ` (including ${rolloverBonus} rollover)` : ""}. Upgrade your plan for more downloads to keep.` };
    }

    await recordUsage(sub.id, bookId, usageType, windowStart, windowEnd);

    const bookPrice = await getBookPrice(bookId);
    if (bookPrice > 0) {
      await addSavings(sub.id, Math.round(bookPrice * 100));
    }

    await trackEvent(`usage_${usageType}`, email, plan.id, sub.id, JSON.stringify({ bookId }));
    return { allowed: true, remaining: Math.max(0, totalLimit - periodDownloads - 1) };
  }

  const current = usage.reads;

  if (!isUnlimited && current >= baseLimit) {
    return { allowed: false, reason: `You've reached your monthly ${usageType} limit (${baseLimit}). Upgrade your plan for more.` };
  }

  const result = await recordUsage(sub.id, bookId, usageType, windowStart, windowEnd);
  if (result.alreadyUsed) {
    return { allowed: true, reason: "Already accessed this book" };
  }

  await trackEvent(`usage_${usageType}`, email, plan.id, sub.id, JSON.stringify({ bookId }));
  return { allowed: true, remaining: isUnlimited ? 99999 : baseLimit - current - 1 };
}

async function getBookPrice(bookId: number): Promise<number> {
  const [book] = await db.select({ price: books.price }).from(books).where(eq(books.id, bookId));
  return book ? parseFloat(book.price) : 0;
}

async function addSavings(subscriptionId: number, amountCents: number) {
  await db.update(subscriptions)
    .set({ savingsTotalCents: sql`${subscriptions.savingsTotalCents} + ${amountCents}` })
    .where(eq(subscriptions.id, subscriptionId));
}

export async function getUpgradeNudge(email: string) {
  const subData = await getSubscriptionWithPlan(email);
  if (!subData) return null;

  const { subscription: sub, plan } = subData;
  if (!sub.currentPeriodStart || !sub.currentPeriodEnd) return null;

  const currentTierIndex = TIER_ORDER.indexOf(plan.tier);
  if (currentTierIndex >= TIER_ORDER.length - 1) return null;

  const { start: windowStart, end: windowEnd } = getMonthlyWindow(sub);
  const periodDownloads = await getDownloadsForSubscriptionPeriod(sub.id, windowStart, windowEnd);
  const totalAvailable = plan.downloadsPerMonth + sub.rolloverCredits;
  const usagePercent = totalAvailable > 0 ? (periodDownloads / totalAvailable) * 100 : 0;

  if (usagePercent < 80) return null;

  const nextTier = TIER_ORDER[currentTierIndex + 1];
  const allPlans = await getPlans();
  const nextPlan = allPlans.find(p => p.tier === nextTier);
  if (!nextPlan) return null;

  return {
    shouldNudge: true,
    currentTier: plan.tier,
    currentDownloads: plan.downloadsPerMonth,
    usedDownloads: periodDownloads,
    nextTier: nextPlan.tier,
    nextTierName: nextPlan.name,
    nextDownloads: nextPlan.downloadsPerMonth,
    nextPrice: nextPlan.monthlyPrice,
    message: `You've used ${periodDownloads} of your ${totalAvailable} downloads. Upgrade to ${nextPlan.name} for ${nextPlan.downloadsPerMonth} downloads at $${nextPlan.monthlyPrice}/mo.`,
  };
}

export function isBookSubscriberExclusive(book: any): boolean {
  if (!book.subscriberExclusiveUntil) return false;
  return new Date(book.subscriberExclusiveUntil) > new Date();
}

export async function trackEvent(eventType: string, customerEmail?: string, planId?: number, subscriptionId?: number, metadata?: string) {
  await db.insert(subscriptionEvents).values({
    eventType,
    customerEmail: customerEmail || null,
    planId: planId || null,
    subscriptionId: subscriptionId || null,
    metadata: metadata || null,
  });
}

export async function getMRRHistory(months: number = 12) {
  const plans = await getPlans();
  const allSubs = await db.select().from(subscriptions);

  const now = new Date();
  const dataPoints: Array<{ month: string; monthlyMRR: number; annualMRR: number; totalMRR: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

    const activeDuringMonth = allSubs.filter(sub => {
      const created = new Date(sub.createdAt);
      const cancelled = sub.cancelledAt ? new Date(sub.cancelledAt) : null;
      if (created > monthEnd) return false;
      if (cancelled && cancelled < monthStart) return false;
      return true;
    });

    const monthlyMRR = activeDuringMonth
      .filter(s => s.billingInterval !== "annual")
      .reduce((sum, sub) => {
        const plan = plans.find(p => p.id === sub.planId);
        return sum + (plan ? parseFloat(plan.monthlyPrice) : 0);
      }, 0);

    const annualMRR = activeDuringMonth
      .filter(s => s.billingInterval === "annual")
      .reduce((sum, sub) => {
        const plan = plans.find(p => p.id === sub.planId);
        if (!plan) return sum;
        const annualPrice = plan.annualPrice ? parseFloat(plan.annualPrice) : parseFloat(plan.monthlyPrice) * 12;
        return sum + annualPrice / 12;
      }, 0);

    dataPoints.push({
      month: monthStart.toLocaleString("default", { month: "short", year: "2-digit" }),
      monthlyMRR: parseFloat(monthlyMRR.toFixed(2)),
      annualMRR: parseFloat(annualMRR.toFixed(2)),
      totalMRR: parseFloat((monthlyMRR + annualMRR).toFixed(2)),
    });
  }

  return dataPoints;
}

export async function getSubscriberHistory(months: number = 12) {
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const events = await db
    .select()
    .from(subscriptionEvents)
    .where(gte(subscriptionEvents.createdAt, windowStart));

  const createdEvents = events.filter(e => e.eventType === "subscription_created");
  const cancelledEvents = events.filter(
    e => e.eventType === "subscription_cancelled" || e.eventType === "subscription_ended"
  );

  const dataPoints: Array<{ month: string; newSubscribers: number; cancellations: number; net: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

    const newSubscribers = createdEvents.filter(e => {
      const d = new Date(e.createdAt);
      return d >= monthStart && d <= monthEnd;
    }).length;

    const cancellations = cancelledEvents.filter(e => {
      const d = new Date(e.createdAt);
      return d >= monthStart && d <= monthEnd;
    }).length;

    dataPoints.push({
      month: monthStart.toLocaleString("default", { month: "short", year: "2-digit" }),
      newSubscribers,
      cancellations,
      net: newSubscribers - cancellations,
    });
  }

  return dataPoints;
}

export async function getMonthlySubscriberDetail(monthLabel: string, eventTypes: string[]) {
  const now = new Date();
  const months: Array<{ label: string; start: Date; end: Date }> = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const label = start.toLocaleString("default", { month: "short", year: "2-digit" });
    months.push({ label, start, end });
  }
  const target = months.find(m => m.label === monthLabel);
  if (!target) return [];

  const events = await db.select().from(subscriptionEvents)
    .where(and(
      gte(subscriptionEvents.createdAt, target.start),
      lte(subscriptionEvents.createdAt, target.end)
    ));

  return events
    .filter(e => eventTypes.includes(e.eventType))
    .map(e => ({ email: e.customerEmail || "unknown", eventType: e.eventType, date: e.createdAt }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getAnalytics(days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const allSubs = await db.select().from(subscriptions);
  const activeSubs = allSubs.filter(s => s.status === "active");

  const monthlySubscribers = activeSubs.filter(s => s.billingInterval !== "annual");
  const annualSubscribers = activeSubs.filter(s => s.billingInterval === "annual");

  const planCounts: Record<string, { total: number; monthly: number; annual: number }> = {};
  for (const sub of activeSubs) {
    const plan = await getPlanById(sub.planId);
    if (plan) {
      if (!planCounts[plan.name]) {
        planCounts[plan.name] = { total: 0, monthly: 0, annual: 0 };
      }
      planCounts[plan.name].total += 1;
      if (sub.billingInterval === "annual") {
        planCounts[plan.name].annual += 1;
      } else {
        planCounts[plan.name].monthly += 1;
      }
    }
  }

  const events = await db.select().from(subscriptionEvents)
    .where(gte(subscriptionEvents.createdAt, since))
    .orderBy(desc(subscriptionEvents.createdAt));

  const newSubscriptions = events.filter(e => e.eventType === "subscription_created").length;
  const cancellations = events.filter(e => e.eventType === "subscription_cancelled" || e.eventType === "subscription_ended").length;
  const upgrades = events.filter(e => e.eventType === "subscription_upgraded_tier").length;
  const downgrades = events.filter(e => e.eventType === "subscription_downgraded_tier").length;
  const checkoutStarts = events.filter(e => e.eventType === "checkout_started").length;

  const tierPageViews = events.filter(e => e.eventType === "pricing_page_view").length;
  const conversionRate = tierPageViews > 0 ? ((newSubscriptions / tierPageViews) * 100).toFixed(1) : "0";

  const recentUsage = await db.select().from(subscriptionUsage)
    .where(gte(subscriptionUsage.createdAt, since));

  const totalReads = recentUsage.filter(u => u.usageType === "read").length;
  const totalDownloads = recentUsage.filter(u => u.usageType === "download").length;

  const plans = await getPlans();

  const monthlySubRevenue = monthlySubscribers.reduce((sum, sub) => {
    const plan = plans.find(p => p.id === sub.planId);
    return sum + (plan ? parseFloat(plan.monthlyPrice) : 0);
  }, 0);

  const annualSubMRR = annualSubscribers.reduce((sum, sub) => {
    const plan = plans.find(p => p.id === sub.planId);
    if (!plan) return sum;
    const annualPrice = plan.annualPrice ? parseFloat(plan.annualPrice) : parseFloat(plan.monthlyPrice) * 12;
    return sum + (annualPrice / 12);
  }, 0);

  const monthlyRevenue = monthlySubRevenue + annualSubMRR;

  const annualSubARR = annualSubscribers.reduce((sum, sub) => {
    const plan = plans.find(p => p.id === sub.planId);
    if (!plan) return sum;
    return sum + (plan.annualPrice ? parseFloat(plan.annualPrice) : parseFloat(plan.monthlyPrice) * 12);
  }, 0);

  const tierClicks: Record<string, number> = {};
  events.filter(e => e.eventType === "tier_clicked").forEach(e => {
    if (e.metadata) {
      try {
        const data = JSON.parse(e.metadata);
        tierClicks[data.tier] = (tierClicks[data.tier] || 0) + 1;
      } catch {}
    }
  });

  const phase2Reminder = {
    launchDate: allSubs.length > 0 ? allSubs.reduce((earliest, s) => {
      const d = new Date(s.createdAt);
      return d < earliest ? d : earliest;
    }, new Date()).toISOString() : null,
    daysSinceLaunch: allSubs.length > 0 ? Math.floor((Date.now() - allSubs.reduce((earliest, s) => {
      const d = new Date(s.createdAt).getTime();
      return d < earliest ? d : earliest;
    }, Date.now())) / (1000 * 60 * 60 * 24)) : 0,
    phase2Ready: false,
    suggestions: [] as string[],
  };

  if (phase2Reminder.daysSinceLaunch >= 60) {
    phase2Reminder.phase2Ready = true;
    phase2Reminder.suggestions.push("Consider adding annual plans (15-20% discount) for popular tiers");
    phase2Reminder.suggestions.push("Consider adding family plans (+$7/member, max 4)");
    phase2Reminder.suggestions.push("Consider adding credit rollover (downloads roll 3 months)");
    phase2Reminder.suggestions.push("Consider adding higher-tier plans with more download slots");
  }

  return {
    totalSubscribers: activeSubs.length,
    totalSubscriptionsEver: allSubs.length,
    monthlySubscribers: monthlySubscribers.length,
    annualSubscribers: annualSubscribers.length,
    monthlyRevenue: monthlyRevenue.toFixed(2),
    monthlySubRevenue: monthlySubRevenue.toFixed(2),
    annualSubMRR: annualSubMRR.toFixed(2),
    annualRecurringRevenue: annualSubARR.toFixed(2),
    newSubscriptions,
    cancellations,
    upgrades,
    downgrades,
    churnRate: allSubs.length > 0 ? ((cancellations / allSubs.length) * 100).toFixed(1) : "0",
    conversionRate,
    tierDistribution: planCounts,
    totalReads,
    totalDownloads,
    avgReadsPerSubscriber: activeSubs.length > 0 ? (totalReads / activeSubs.length).toFixed(1) : "0",
    avgDownloadsPerSubscriber: activeSubs.length > 0 ? (totalDownloads / activeSubs.length).toFixed(1) : "0",
    pricingPageViews: tierPageViews,
    tierClicks,
    recentEvents: events.slice(0, 50),
    phase2Reminder,
  };
}

export async function getActiveCheckout(email: string) {
  const [checkout] = await db.select()
    .from(activeCheckouts)
    .where(and(
      eq(activeCheckouts.customerEmail, email),
      isNull(activeCheckouts.returnedAt)
    ))
    .limit(1);
  return checkout || null;
}

export async function checkoutBook(email: string, bookId: number) {
  const subData = await getSubscriptionWithPlan(email);
  if (!subData) return { success: false, error: "No active subscription" };

  const { subscription: sub, plan } = subData;

  const existing = await getActiveCheckout(email);
  if (existing) {
    if (existing.bookId === bookId) {
      return { success: true, alreadyCheckedOut: true };
    }
    return { success: false, error: "You already have a book checked out. Return it first to check out a new one.", currentBookId: existing.bookId };
  }

  if (!sub.currentPeriodStart || !sub.currentPeriodEnd) {
    return { success: false, error: "Invalid subscription period" };
  }
  const readResult = await checkAndRecordUsage(email, bookId, "read");
  if (!readResult.allowed) return { success: false, error: readResult.reason };

  try {
    await db.insert(activeCheckouts).values({
      subscriptionId: sub.id,
      customerEmail: email,
      bookId,
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return { success: false, error: "You already have a book checked out. Return it first to check out a new one." };
    }
    throw err;
  }

  await trackEvent("book_checkout", email, plan.id, sub.id, JSON.stringify({ bookId }));
  return { success: true };
}

export async function returnBook(email: string) {
  const existing = await getActiveCheckout(email);
  if (!existing) return { success: false, error: "No book currently checked out" };

  await db.update(activeCheckouts)
    .set({ returnedAt: new Date() })
    .where(eq(activeCheckouts.id, existing.id));

  const subData = await getSubscriptionWithPlan(email);
  if (subData) {
    await trackEvent("book_return", email, subData.plan.id, subData.subscription.id, JSON.stringify({ bookId: existing.bookId }));
  }

  return { success: true, returnedBookId: existing.bookId };
}

export async function getCheckoutHistory(email: string) {
  return db.select()
    .from(activeCheckouts)
    .where(eq(activeCheckouts.customerEmail, email))
    .orderBy(desc(activeCheckouts.checkedOutAt));
}

// Plan-level info returned by the authenticated session endpoint. This type
// intentionally excludes all customer-level fields (email, Stripe customer ID,
// payment method, etc.) so even authenticated callers cannot harvest personal
// data beyond the public plan details they already purchased.
export type SessionPlanInfo = {
  tier: string;
  billingInterval: "monthly" | "annual";
  planName: string;
  monthlyPrice: string;
  annualPrice: string | null;
};

// Fetches plan-level info for a Stripe checkout session after verifying that
// the caller's OTP-verified email owns the session. Returns null if the session
// is not found, has no recognisable tier, or the email does not match.
// Throws { code: "EMAIL_MISMATCH" } when the caller is authenticated but does
// not own the session so the route can return 403 rather than 404.
export async function getSessionPlanInfo(
  sessionId: string,
  verifiedEmail: string,
): Promise<SessionPlanInfo | null> {
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // Verify ownership: the session's customer_email must match the OTP-verified
  // caller email. Both sides are normalised to lower-case for comparison.
  const sessionEmail = (session.customer_email ?? "").toLowerCase().trim();
  if (!sessionEmail || sessionEmail !== verifiedEmail.toLowerCase().trim()) {
    const err: any = new Error("Session does not belong to the verified email");
    err.code = "EMAIL_MISMATCH";
    throw err;
  }

  const tier = (session.metadata?.tier as string) || "";
  const billingInterval: "monthly" | "annual" =
    session.metadata?.billingInterval === "annual" ? "annual" : "monthly";
  const planIdStr = session.metadata?.planId;

  if (!tier) return null;

  let plan: typeof subscriptionPlans.$inferSelect | undefined;
  if (planIdStr) {
    const planId = parseInt(planIdStr, 10);
    if (!isNaN(planId)) {
      [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
    }
  }
  if (!plan) {
    [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.tier, tier));
  }

  if (!plan) return null;

  // Explicitly construct the whitelisted response so customer-level fields
  // (email, customer ID, payment method) can never appear in the API response.
  const info: SessionPlanInfo = {
    tier: plan.tier,
    billingInterval,
    planName: plan.name,
    monthlyPrice: plan.monthlyPrice,
    annualPrice: plan.annualPrice ?? null,
  };
  return info;
}
