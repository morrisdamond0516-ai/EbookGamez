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

/**
 * Factory that creates the /healthz request handler.
 * `timeoutMs` defaults to HEALTHZ_CHECK_TIMEOUT_MS (3 s) and can be
 * overridden in tests to avoid slow real waits.
 */
export function createHealthzHandler(timeoutMs = HEALTHZ_CHECK_TIMEOUT_MS): RequestHandler {
  return async (_req, res) => {
    const checks: { db: boolean; stripe: boolean } = { db: false, stripe: false };

    // DB check: borrow a client from the shared pool — no new connection overhead
    try {
      const { pool: dbPool } = await import('./storage');
      await withTimeout(dbPool.query('SELECT 1'), 'DB', timeoutMs);
      checks.db = true;
    } catch (err: any) {
      console.error('[Healthz] DB check failed:', err.message);
    }

    // Stripe check: verify the secret key is present and the client can be instantiated
    try {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set');
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(secretKey, { apiVersion: '2025-11-17.clover' as any });
      // A minimal read-only call to confirm the key is valid
      await withTimeout(stripe.balance.retrieve(), 'Stripe', timeoutMs);
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
