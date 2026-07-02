# GA4 Conversion Events Configuration Log

This file records the conversion event configuration applied to the
EbookGamez GA4 property via the `scripts/ga4-conversions-setup.mjs` script.

> **Security note:** OAuth access tokens are short-lived (~1 hour) and must
> never be committed to the repository or pasted into log files. Always pass
> them as a CLI argument at runtime and discard them after use.

## Property

| Field | Value |
|-------|-------|
| Property name | Ebookgamez.com |
| Property ID | 535282672 |
| Measurement ID | G-86TGGPV1F3 |
| GA4 Admin link | https://analytics.google.com/analytics/web/#/p535282672/admin/conversions |

## Applied Conversion Events

| Event | Status | Conversion Event Resource Name | Date Applied |
|-------|--------|-------------------------------|--------------|
| `purchase` | Already configured — no change needed | (pre-existing) | — |
| `sign_up` | Created via GA4 Admin API | `properties/535282672/conversionEvents/14802044787` | 2026-05-04 |
| `subscription_upgrade` | Created via GA4 Admin API | `properties/535282672/conversionEvents/14820530699` | 2026-05-06 |
| `begin_checkout` | Created via GA4 Admin API | `properties/535282672/conversionEvents/14820389455` | 2026-05-06 |
| `view_item` | Created via GA4 Admin API | `properties/535282672/conversionEvents/14820057123` | 2026-05-06 |
| `billing_interval_to_annual` | Created via GA4 Admin API | `properties/535282672/conversionEvents/14820381965` | 2026-05-06 |

## subscription_upgrade Conversion — Analytics Team Notes

### Why a dedicated event instead of filtering subscription_change?

GA4's Admin API can only mark entire event names as conversions. It cannot
apply parameter-level filters (e.g. `subscription_action = "upgrade"`) when
creating a conversion event. To cleanly track upgrades as a distinct
conversion goal without requiring a manual UI filter, the frontend now fires
two events on every subscription upgrade:

1. **`subscription_change`** — always fires for both upgrades and downgrades,
   carrying `subscription_action: "upgrade" | "downgrade"`. Use this for
   general subscription-change analysis.

2. **`subscription_upgrade`** — fires only when `subscription_action` would be
   `"upgrade"`. This is the event to use as a conversion goal.

### Registering subscription_upgrade as a conversion

Run the setup script with a fresh OAuth access token:

```
node scripts/ga4-conversions-setup.mjs "ya29...."
```

The script is idempotent — safe to re-run. It will skip `purchase` and
`sign_up` (already configured) and add `subscription_upgrade` as a new
conversion event.

### Event parameters

Both `subscription_change` and `subscription_upgrade` carry the following
parameters that can be used in GA4 exploration reports and audiences:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `previous_plan` | Display name of the old plan | `"Basic"` |
| `previous_tier` | Machine key of the old plan | `"basic"` |
| `new_plan` | Display name of the new plan | `"Premium"` |
| `new_tier` | Machine key of the new plan | `"premium"` |
| `price_delta` | Price difference in USD (positive = more expensive) | `5.00` |
| `ecommerce.value` | New plan price in USD | `14.99` |
| `ecommerce.currency` | Always `"USD"` | `"USD"` |

### Verifying in GA4

After running the script:

1. Go to **Admin → Conversions** in the GA4 property.
2. Confirm `subscription_upgrade` appears with the toggle **ON**.
3. To confirm events are arriving: **Reports → Realtime** and perform a test
   upgrade on staging — you should see `subscription_upgrade` in the event
   stream.

## billing_interval_to_annual Conversion — Analytics Team Notes

### Why a dedicated event instead of filtering billing_interval_switch?

GA4's Admin API can only mark entire event names as conversions. It cannot
apply parameter-level filters (e.g. `to_interval = "annual"`) when creating a
conversion event. To cleanly track annual switches as a distinct conversion goal
without requiring a manual UI filter, the frontend now fires two events whenever
a user switches to annual billing:

1. **`billing_interval_switch`** — always fires for both monthly→annual and
   annual→monthly switches, carrying `from_interval` and `to_interval`
   parameters. Use this for general interval-switch analysis.

2. **`billing_interval_to_annual`** — fires only when `to_interval` would be
   `"annual"`. This is the event to use as a conversion goal (switching to
   annual is a high-LTV, low-churn revenue signal).

### Registering billing_interval_to_annual as a conversion

Run the setup script with a fresh OAuth access token:

```
node scripts/ga4-conversions-setup.mjs "ya29...."
```

The script is idempotent — safe to re-run. It will skip already-configured
events and add `billing_interval_to_annual` as a new conversion event.

### Event parameters

Both `billing_interval_switch` and `billing_interval_to_annual` carry the
following parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `plan_name` | Display name of the plan | `"Premium"` |
| `plan_tier` | Machine key of the plan | `"premium"` |
| `from_interval` | Previous billing interval | `"monthly"` |
| `to_interval` | New billing interval | `"annual"` |
| `old_price` | Price before the switch (USD) | `18.99` |
| `new_price` | Price after the switch (USD) | `189.90` |
| `annual_savings` | USD saved vs 12× monthly | `37.98` |
| `ecommerce.value` | New price in USD | `189.90` |
| `ecommerce.currency` | Always `"USD"` | `"USD"` |

## Script Output (verification run — 2026-05-20, all events confirmed active)

```
=== EbookGamez GA4 Conversion Events Setup ===
Target measurement ID: G-86TGGPV1F3
Events to mark as conversions: purchase, sign_up, subscription_upgrade, begin_checkout, view_item, billing_interval_to_annual

Fetching account summaries to locate property...
Found property: Ebookgamez.com (properties/535282672)

Checking existing conversion events...
Currently marked as conversions: purchase, close_convert_lead, qualify_lead, sign_up, view_item, billing_interval_to_annual, begin_checkout, subscription_upgrade

Configuring conversion events...
  [SKIPPED] 'purchase' is already a conversion event.
  [SKIPPED] 'sign_up' is already a conversion event.
  [SKIPPED] 'subscription_upgrade' is already a conversion event.
  [SKIPPED] 'begin_checkout' is already a conversion event.
  [SKIPPED] 'view_item' is already a conversion event.
  [SKIPPED] 'billing_interval_to_annual' is already a conversion event.

=== Done! ===
Verify in GA4: Admin > Conversions
Direct link: https://analytics.google.com/analytics/web/#/p535282672/admin/conversions
```

All 6 conversion events confirmed active as of 2026-05-20. No changes needed.

---

## Script Output (initial run — purchase + sign_up)

```
=== EbookGamez GA4 Conversion Events Setup ===
Target measurement ID: G-86TGGPV1F3
Events to mark as conversions: purchase, sign_up

Fetching account summaries to locate property...
Found property: Ebookgamez.com (properties/535282672)

Checking existing conversion events...
Currently marked as conversions: purchase, close_convert_lead, qualify_lead

Configuring conversion events...
  [SKIPPED] 'purchase' is already a conversion event.
  [CREATED] 'sign_up' marked as conversion (name: properties/535282672/conversionEvents/14802044787)

=== Done! ===
Verify in GA4: Admin > Conversions
Direct link: https://analytics.google.com/analytics/web/#/p535282672/admin/conversions
```

## Script Output (second run — subscription_upgrade + begin_checkout + view_item + billing_interval_to_annual)

```
=== EbookGamez GA4 Conversion Events Setup ===
Target measurement ID: G-86TGGPV1F3
Events to mark as conversions: purchase, sign_up, subscription_upgrade, begin_checkout, view_item, billing_interval_to_annual

Fetching account summaries to locate property...
Found property: Ebookgamez.com (properties/535282672)

Checking existing conversion events...
Currently marked as conversions: purchase, close_convert_lead, qualify_lead, sign_up

Configuring conversion events...
  [SKIPPED] 'purchase' is already a conversion event.
  [SKIPPED] 'sign_up' is already a conversion event.
  [CREATED] 'subscription_upgrade' marked as conversion (name: properties/535282672/conversionEvents/14820530699)
  [CREATED] 'begin_checkout' marked as conversion (name: properties/535282672/conversionEvents/14820389455)
  [CREATED] 'view_item' marked as conversion (name: properties/535282672/conversionEvents/14820057123)
  [CREATED] 'billing_interval_to_annual' marked as conversion (name: properties/535282672/conversionEvents/14820381965)

=== Done! ===
Verify in GA4: Admin > Conversions
Direct link: https://analytics.google.com/analytics/web/#/p535282672/admin/conversions
```

## Code-Level Verification (2026-05-07)

The following table records the full end-to-end pipeline status for each conversion event,
verified by auditing the source code, GTM container export, and Admin API script output.

| Event | Frontend fires? | GTM tag exists? | GA4 conversion registered? | Data reaching GA4? |
|-------|----------------|-----------------|----------------------------|-------------------|
| `purchase` | ✅ `trackPurchase()` in `checkout-success.tsx:81` and `trackSubscriptionPurchase()` in `subscription-success.tsx:125,133` | ✅ Tag ID 23 in container (original) | ✅ Pre-existing | ✅ Live |
| `sign_up` | ✅ `trackSignUp("email")` in `customer-signup.tsx:39` | ✅ Tag ID 24 in container (original) | ✅ Created 2026-05-04 | ✅ Live |
| `begin_checkout` | ✅ `trackBeginCheckout()` in `cart.tsx:97` and `book-detail.tsx:540`; `trackSubscriptionBeginCheckout()` in `subscription.tsx:251` | ✅ Tag ID 22 in container (original) | ✅ Created 2026-05-06 | ✅ Live |
| `view_item` | ✅ `trackViewItem()` in `book-detail.tsx:424` (fires on `useEffect` when book loads) | ✅ Tag ID 21 in container (original) | ✅ Created 2026-05-06 | ✅ Live |
| `subscription_upgrade` | ✅ `trackSubscriptionChange()` in `subscription.tsx:412` (fires `subscription_upgrade` event when `action === "upgrade"` — see `analytics.ts:256`) | ⚠️ **Missing from original container** — Tag ID 25 added 2026-05-07 | ✅ Created 2026-05-06 | ⏳ Pending GTM publish |
| `billing_interval_to_annual` | ✅ `trackBillingIntervalSwitch()` in `subscription.tsx:313,359` (fires `billing_interval_to_annual` when `toInterval === "annual"` — see `analytics.ts:204`) | ⚠️ **Missing from original container** — Tag ID 26 added 2026-05-07 | ✅ Created 2026-05-06 | ⏳ Pending GTM publish |

### Summary

- **4 of 6 events** (`purchase`, `sign_up`, `begin_checkout`, `view_item`) are fully live end-to-end.
- **2 of 6 events** (`subscription_upgrade`, `billing_interval_to_annual`) are correctly implemented
  in the frontend and registered in GA4, but were **never reaching GA4** due to missing GTM tags.
  The `gtm-container-export.json` has been corrected (tags 25 & 26 added) but the container
  must be re-imported and published in GTM to go live. See the "Action required" section below.

## Verification

`purchase`, `sign_up`, `subscription_upgrade`, `begin_checkout`, `view_item`, and `billing_interval_to_annual` are all active conversion goals in the GA4 property.
To confirm in GA4: **Admin → Conversions** and look for all six events with the toggle ON.

## Discrepancy Found & Fixed (2026-05-07)

### Problem

During verification, a gap was identified between the GA4 Admin API registrations and the GTM
container: the original `gtm-container-export.json` only contained event tags for four of the
six conversion events (`view_item`, `begin_checkout`, `purchase`, `sign_up`). The two newer
events — `subscription_upgrade` and `billing_interval_to_annual` — were **missing GTM tags**.

**Impact:** Although both events were correctly pushed to `window.dataLayer` by the frontend
analytics code (`client/src/lib/analytics.ts`), and both were registered as GA4 conversion
goals via the Admin API, there were no GTM triggers or tags to forward them from the dataLayer
to GA4. This means GA4 reports would show 0 conversions for these two events despite the
toggles being ON.

### Root cause

The original container export was created before `subscription_upgrade` and
`billing_interval_to_annual` were designed and implemented. The subsequent Admin API run
registered them as conversion goals in GA4 but the GTM container was never updated to
match.

### Fix applied

`gtm-container-export.json` was updated with:

| Added | Type | Purpose |
|-------|------|---------|
| `DLV - previous_plan` | Variable | Reads `previous_plan` from dataLayer |
| `DLV - new_plan` | Variable | Reads `new_plan` from dataLayer |
| `DLV - price_delta` | Variable | Reads `price_delta` from dataLayer |
| `DLV - plan_name` | Variable | Reads `plan_name` from dataLayer |
| `DLV - from_interval` | Variable | Reads `from_interval` from dataLayer |
| `DLV - to_interval` | Variable | Reads `to_interval` from dataLayer |
| `DLV - annual_savings` | Variable | Reads `annual_savings` from dataLayer |
| `CE - subscription_upgrade` | Trigger | Custom event trigger for `subscription_upgrade` |
| `CE - billing_interval_to_annual` | Trigger | Custom event trigger for `billing_interval_to_annual` |
| `GA4 - subscription_upgrade` | Tag | Sends event to GA4 with value, currency, plan details |
| `GA4 - billing_interval_to_annual` | Tag | Sends event to GA4 with value, currency, interval details |

### Action required — GTM re-import

The `gtm-container-export.json` file has been updated. A **GTM admin must re-import** this
file to activate the two new tags. Steps:

1. Go to [tagmanager.google.com](https://tagmanager.google.com) → container **GTM-M7X424JG**
2. **Admin → Import Container** → select `gtm-container-export.json`
3. Choose **Existing workspace → Default Workspace**
4. Choose **Merge** (not Overwrite) to keep any existing live tags
5. Click **Confirm**, then **Preview** to verify all 6 event tags show up
6. **Submit → Publish** with version name: `GA4 — add subscription_upgrade + billing_interval_to_annual tags`

### After publishing

Verify in GA4 **Realtime** that both events appear when triggered:
- Perform a subscription upgrade → look for `subscription_upgrade` in the event stream
- Toggle billing to annual on the subscription page → look for `billing_interval_to_annual`

Once live data flows, both events should accumulate conversion counts in
**Reports → Conversions** within 24–48 hours.
