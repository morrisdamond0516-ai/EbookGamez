# GTM Activation Guide — EbookGamez GA4 Setup

## Status

The container export file `gtm-container-export.json` is fully prepared and ready to import. The GA4 Measurement ID (`G-86TGGPV1F3`) is already embedded in the file — no manual substitution needed.

## What the Export File Contains

| Type | Name | Purpose |
|------|------|---------|
| **Variable** | GA4 Measurement ID | Constant = `G-86TGGPV1F3` |
| **Variable** | DLV - ecommerce.value | Data Layer Variable for purchase value |
| **Variable** | DLV - ecommerce.transaction_id | Data Layer Variable for transaction ID |
| **Variable** | DLV - ecommerce.currency | Data Layer Variable for currency |
| **Variable** | DLV - ecommerce.items | Data Layer Variable for items array |
| **Variable** | DLV - method | Data Layer Variable for sign-up method |
| **Tag** | GA4 - Configuration | Fires on All Pages, loads GA4 with `G-86TGGPV1F3` |
| **Tag** | GA4 - view_item | Fires on CE - view_item trigger |
| **Tag** | GA4 - begin_checkout | Fires on CE - begin_checkout trigger |
| **Tag** | GA4 - purchase | Fires on CE - purchase trigger |
| **Tag** | GA4 - sign_up | Fires on CE - sign_up trigger |
| **Tag** | GA4 - subscription_upgrade | Fires on CE - subscription_upgrade trigger |
| **Tag** | GA4 - billing_interval_to_annual | Fires on CE - billing_interval_to_annual trigger |
| **Trigger** | All Pages | Page View — fires on every page |
| **Trigger** | CE - view_item | Custom Event: `view_item` |
| **Trigger** | CE - begin_checkout | Custom Event: `begin_checkout` |
| **Trigger** | CE - purchase | Custom Event: `purchase` |
| **Trigger** | CE - sign_up | Custom Event: `sign_up` |
| **Trigger** | CE - subscription_upgrade | Custom Event: `subscription_upgrade` |
| **Trigger** | CE - billing_interval_to_annual | Custom Event: `billing_interval_to_annual` |

## Steps to Activate in GTM Dashboard

1. Go to [tagmanager.google.com](https://tagmanager.google.com) and open container **GTM-M7X424JG**
2. In the left nav, go to **Admin** > **Import Container**
3. Select `gtm-container-export.json` from this repository
4. Choose **Existing workspace** > **Default Workspace**
5. Choose **Merge** (not Overwrite) to preserve any existing tags
6. Click **Confirm**

## Verify Before Publishing

1. Click **Preview** in the top-right corner of GTM
2. Enter your site URL and click **Connect**
3. Navigate to a book detail page — the `view_item` tag should fire
4. Add a book to cart and go to checkout — `begin_checkout` should fire
5. Complete a test purchase — `purchase` should fire with transaction data
6. Sign up with a test account — `sign_up` should fire with `method` parameter
7. Perform a subscription upgrade — `subscription_upgrade` should fire with plan details
8. Toggle billing to annual on the subscription page — `billing_interval_to_annual` should fire
9. Confirm all 7 tags show as **Fired** in the GTM Preview panel

## Publish

1. Close Preview mode
2. Click **Submit** in the top-right corner
3. Add a version name: `GA4 — add subscription_upgrade + billing_interval_to_annual tags`
4. Click **Publish**

## After Publishing

- Record the published GTM version number here: **Version #___**
- The downstream task "Confirm GA4 is receiving live events" should be run next to verify events appear in the GA4 DebugView and real-time reports

## GA4 Conversion Goals — Current Status (as of 2026-05-07)

All six conversion events are already registered in GA4 via the Admin API. No script re-run is needed. The six registered events are:

| Event | GA4 Resource Name | Date |
|-------|-------------------|------|
| `purchase` | (pre-existing) | — |
| `sign_up` | `properties/535282672/conversionEvents/14802044787` | 2026-05-04 |
| `begin_checkout` | `properties/535282672/conversionEvents/14820389455` | 2026-05-06 |
| `view_item` | `properties/535282672/conversionEvents/14820057123` | 2026-05-06 |
| `subscription_upgrade` | `properties/535282672/conversionEvents/14820530699` | 2026-05-06 |
| `billing_interval_to_annual` | `properties/535282672/conversionEvents/14820381965` | 2026-05-06 |

To re-run the script for new events in the future:

```bash
node scripts/ga4-conversions-setup.mjs "ya29.YOUR_ACCESS_TOKEN_HERE"
```

The script is **idempotent** — it skips events that are already marked as conversions.
See `docs/ga4-conversion-events-log.md` for full script output history.

## GA4 Property

- **Measurement ID**: `G-86TGGPV1F3`
- Find it in GA4 at: Admin > Data Streams > [your web stream] > Measurement ID
