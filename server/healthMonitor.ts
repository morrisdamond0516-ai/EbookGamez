/**
 * Health Monitor — production-only
 *
 * Polls /healthz every minute. After two consecutive non-"ok" responses it
 * posts a Slack alert that names the failing subsystem(s). A recovery
 * message is sent once the endpoint comes back healthy.
 *
 * Only starts when REPLIT_DEPLOYMENT === '1'.
 *
 * Alert latch behaviour:
 *   alertFired is only set to true when Slack confirms ok:true.
 *   If delivery fails the monitor retries on every subsequent poll cycle
 *   until the first successful delivery (or until health recovers).
 */

const POLL_INTERVAL_MS = 60_000; // 1 minute
const ALERT_AFTER_CONSECUTIVE = 2;

interface HealthPayload {
  status: string;
  db: boolean;
  stripe: boolean;
}

let consecutiveFailures = 0;
/** true only after Slack has confirmed delivery of the degraded alert */
let alertFired = false;
let monitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Post a message to Slack.
 * Returns true when Slack responds with ok:true, false on any failure
 * (missing token, network error, or Slack API error).
 * Never throws.
 */
async function sendSlackMessage(text: string): Promise<boolean> {
  const token = process.env.SLACK_LIVE_API_KEY;
  if (!token) {
    console.warn('[HealthMonitor] SLACK_LIVE_API_KEY not set — cannot send alert');
    return false;
  }

  // Use the #alerts channel by default; override with SLACK_ALERT_CHANNEL if set.
  const channel = process.env.SLACK_ALERT_CHANNEL || '#alerts';

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, text }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!data.ok) {
      console.error('[HealthMonitor] Slack API error:', data.error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[HealthMonitor] Slack request failed:', err.message);
    return false;
  }
}

function buildAlertText(payload: HealthPayload): string {
  const failing: string[] = [];
  if (!payload.db) failing.push('database (db)');
  if (!payload.stripe) failing.push('Stripe');
  const subsystems = failing.length > 0 ? failing.join(', ') : 'unknown subsystem';
  return (
    `:rotating_light: *Production health check FAILING* — status: \`${payload.status}\`\n` +
    `Failing subsystem(s): *${subsystems}*\n` +
    `Endpoint: /healthz  |  Consecutive failures: ${consecutiveFailures}`
  );
}

async function pollHealthz(): Promise<void> {
  const host = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : `http://127.0.0.1:${process.env.PORT || 5000}`;

  let payload: HealthPayload = { status: 'unknown', db: false, stripe: false };
  let isHealthy = false;

  try {
    const response = await fetch(`${host}/healthz`, {
      headers: { 'User-Agent': 'HealthMonitor/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    payload = (await response.json()) as HealthPayload;
    isHealthy = payload.status === 'ok';
  } catch (err: any) {
    console.error('[HealthMonitor] Poll request failed:', err.message);
    payload = { status: 'unreachable', db: false, stripe: false };
    isHealthy = false;
  }

  if (isHealthy) {
    if (alertFired) {
      console.log('[HealthMonitor] Health restored — sending recovery alert');
      const sent = await sendSlackMessage(
        `:white_check_mark: *Production health check RECOVERED* — all subsystems healthy`,
      );
      if (sent) {
        alertFired = false;
      } else {
        console.warn('[HealthMonitor] Recovery alert delivery failed; will retry next poll');
      }
    }
    consecutiveFailures = 0;
    if (!alertFired) {
      console.log('[HealthMonitor] OK');
    }
  } else {
    consecutiveFailures += 1;
    console.warn(
      `[HealthMonitor] Degraded (${consecutiveFailures} consecutive) — db:${payload.db} stripe:${payload.stripe}`,
    );

    if (consecutiveFailures >= ALERT_AFTER_CONSECUTIVE && !alertFired) {
      console.error('[HealthMonitor] Threshold reached — sending Slack alert');
      const sent = await sendSlackMessage(buildAlertText(payload));
      if (sent) {
        alertFired = true;
        console.log('[HealthMonitor] Alert delivered successfully');
      } else {
        // alertFired stays false so the next poll retries delivery
        console.warn('[HealthMonitor] Alert delivery failed — will retry next poll');
      }
    }
  }
}

/**
 * Trigger a one-off simulated degraded alert for testing purposes.
 * Sends a clearly-labelled test message to the configured Slack channel.
 * Returns true when Slack confirms delivery, false otherwise.
 * Never throws.
 */
export async function triggerTestAlert(): Promise<{ sent: boolean; channel: string }> {
  const channel = process.env.SLACK_ALERT_CHANNEL || '#alerts';
  const text =
    `:test_tube: *[TEST] Production health alert test* — this is a manually-triggered test message.\n` +
    `If you received this, the Slack integration is working correctly.\n` +
    `Channel: ${channel}  |  Endpoint: /healthz`;
  const sent = await sendSlackMessage(text);
  return { sent, channel };
}

/**
 * Start the health monitor. Safe to call multiple times — only the first call
 * actually starts the interval.
 */
export function startHealthMonitor(): void {
  const isDeployed = process.env.REPLIT_DEPLOYMENT === '1';
  if (!isDeployed) {
    console.log('[HealthMonitor] Not in production — skipping monitor startup');
    return;
  }
  if (monitorInterval) return;

  // First poll after a short delay so the server is fully initialised.
  setTimeout(() => {
    pollHealthz().catch(() => {});
    monitorInterval = setInterval(() => {
      pollHealthz().catch(() => {});
    }, POLL_INTERVAL_MS);
  }, 30_000);

  console.log('[HealthMonitor] Started — polling /healthz every 60 s');
}
