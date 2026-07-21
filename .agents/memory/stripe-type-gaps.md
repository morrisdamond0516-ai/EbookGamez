---
name: Stripe SDK type gaps — current_period_start/end
description: Stripe Response<Subscription> type missing current_period_start and current_period_end; use (updated as any)
---

## Rule
When reading `current_period_start` or `current_period_end` from a Stripe subscription update response, cast the result object with `(updated as any)`.

## Why
The installed Stripe SDK TypeScript types don't include `current_period_start`/`current_period_end` on `Response<Subscription>`. The fields exist at runtime on the actual Stripe API response object.

## How to apply
In subscriptionService.ts, anywhere an updated Stripe subscription is read: `new Date((updated as any).current_period_start * 1000)`.
