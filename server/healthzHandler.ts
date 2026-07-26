import type { RequestHandler } from "express";

export const HEALTHZ_CHECK_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

// ---------------------------------------------------------------------------
// Stripe client singleton
//
// The client promise is created once and reused across health requests.
// This means the `withTimeout` wrapper in the health check covers the entire
// Stripe initialisation (including the `import('stripe')` call) rather than
// only `balance.retrieve()`.  If the module import itself stalls the timeout
// will still fire and report stripe: false.
//
// Rejections are NOT cached — if initialisation fails the next request
// retries, which lets transient errors (missing env var at startup, etc.)
// recover without a process restart.
// ---------------------------------------------------------------------------

/** Minimal interface for the subset of the Stripe client used here. */
export interface StripeClientLike {
  balance: { retrieve: () => Promise<unknown> };
}

let _stripeClientPromise: Promise<StripeClientLike> | null = null;

function buildStripeClientPromise(): Promise<StripeClientLike> {
  const p = (async () => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set');
    const Stripe = (await import('stripe')).default;
    return new Stripe(secretKey, { apiVersion: '2025-11-17.clover' as any }) as unknown as StripeClientLike;
  })();
  // Do not cache a rejected promise — reset so the next request retries.
  p.catch(() => { _stripeClientPromise = null; });
  return p;
}

/**
 * Returns the cached Stripe client promise, creating it on first call.
 * Exported so tests can reset the module-level cache via
 * `resetStripeClientCache()`.
 */
export function getStripeClient(): Promise<StripeClientLike> {
  if (!_stripeClientPromise) {
    _stripeClientPromise = buildStripeClientPromise();
  }
  return _stripeClientPromise;
}

/** Clears the cached client — useful in tests to isolate state. */
export function resetStripeClientCache(): void {
  _stripeClientPromise = null;
}

// ---------------------------------------------------------------------------
// Health-check handler
// ---------------------------------------------------------------------------

/**
 * Factory that creates the /healthz request handler.
 *
 * @param timeoutMs      - per-check timeout (default HEALTHZ_CHECK_TIMEOUT_MS).
 * @param stripeGetter   - override the Stripe client supplier for testing.
 *                         Defaults to the module-level `getStripeClient`.
 */
export function createHealthzHandler(
  timeoutMs = HEALTHZ_CHECK_TIMEOUT_MS,
  stripeGetter: () => Promise<StripeClientLike> = getStripeClient,
): RequestHandler {
  return async (_req, res) => {
    const checks: { db: boolean; stripe: boolean } = { db: false, stripe: false };

    // DB check: borrow a client from the shared pool — no new connection overhead.
    // withTimeout wraps the entire pool.query() call, which internally acquires a
    // connection first.  If the pool is exhausted (all connections busy), pool.query
    // will queue and never settle until a connection becomes available.  The timeout
    // fires before that budget is reached, so a saturated pool is handled the same
    // way as a hung query — the check times out and reports db: false.
    try {
      const { pool: dbPool } = await import('./storage');
      await withTimeout(dbPool.query('SELECT 1'), 'DB', timeoutMs);
      checks.db = true;
    } catch (err: any) {
      console.error('[Healthz] DB check failed:', err.message);
    }

    // Stripe check: the single withTimeout covers BOTH the client
    // initialisation (including the module import) and the balance.retrieve()
    // call.  If either phase stalls — including an import-level hang — the
    // timeout fires and reports stripe: false.
    try {
      await withTimeout(
        (async () => {
          const stripe = await stripeGetter();
          await stripe.balance.retrieve();
        })(),
        'Stripe',
        timeoutMs,
      );
      checks.stripe = true;
    } catch (err: any) {
      console.error('[Healthz] Stripe check failed:', err.message);
    }

    const allOk = checks.db && checks.stripe;
    const status = allOk ? 'ok' : 'degraded';
    res.status(allOk ? 200 : 503).json({ status, ...checks });
  };
}

/** Default production handler — uses the standard 3 s timeout. */
export const healthzHandler = createHealthzHandler();
