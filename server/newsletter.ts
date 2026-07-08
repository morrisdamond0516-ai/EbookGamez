import type { Express, Request, Response } from "express";

const RESEND_API = "https://api.resend.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewsletterConfig = {
  apiKey: string;
  from: string;
  audienceId?: string;
  replyTo: string;
  siteUrl: string;
  learnforgeUrl: string;
};

async function getReplitResendCredentials(): Promise<{ apiKey: string; from: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;

  if (!hostname || !xReplitToken) return null;

  try {
    const data = (await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=resend`,
      {
        headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
      },
    ).then((res) => res.json())) as { items?: { settings?: { api_key?: string; from_email?: string } }[] };

    const settings = data.items?.[0]?.settings;
    if (!settings?.api_key || !settings?.from_email) return null;
    return { apiKey: settings.api_key, from: settings.from_email };
  } catch {
    return null;
  }
}

export async function getNewsletterConfig(): Promise<NewsletterConfig | null> {
  const envKey = process.env.RESEND_API_KEY?.trim();
  const envFrom =
    process.env.RESEND_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim();

  let apiKey = envKey;
  let from = envFrom;

  if (!apiKey || !from) {
    const replit = await getReplitResendCredentials();
    if (!replit) return null;
    apiKey = replit.apiKey;
    from = replit.from;
  }

  return {
    apiKey: apiKey!,
    from: from!,
    audienceId: process.env.RESEND_AUDIENCE_ID?.trim() || undefined,
    replyTo:
      process.env.RESEND_REPLY_TO?.trim() ||
      process.env.OWNER_NOTIFY_EMAIL?.trim() ||
      "ebookgames@yahoo.com",
    siteUrl:
      process.env.PUBLIC_SITE_URL?.trim() ||
      (process.env.REPLIT_DEPLOYMENT_URL
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
        : "https://ebookgamez.com"),
    learnforgeUrl:
      process.env.LEARNFORGE_PUBLIC_URL?.trim() ||
      process.env.PUBLIC_LEARNFORGE_URL?.trim() ||
      "https://ebookgamez.com",
  };
}

export function isNewsletterConfiguredSync(): boolean {
  const envOk =
    !!process.env.RESEND_API_KEY?.trim() &&
    !!(process.env.RESEND_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim());
  const replitOk =
    !!process.env.REPLIT_CONNECTORS_HOSTNAME &&
    !!(process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);
  return envOk || replitOk;
}

async function resendPost(
  config: NewsletterConfig,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data?: unknown }> {
  const res = await fetch(`${RESEND_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = undefined;
  }
  return { ok: res.ok, status: res.status, data };
}

async function addToAudience(config: NewsletterConfig, email: string, source: string): Promise<void> {
  if (!config.audienceId) return;
  const result = await resendPost(config, `/audiences/${config.audienceId}/contacts`, {
    email,
    unsubscribed: false,
    first_name: source.slice(0, 50),
  });
  if (!result.ok && result.status !== 409) {
    console.warn("[Newsletter] Audience contact failed:", result.status, result.data);
  }
}

function welcomeHtml(config: NewsletterConfig): string {
  const games = `${config.siteUrl.replace(/\/$/, "")}/games`;
  const learnforgeGames = `${config.learnforgeUrl.replace(/\/$/, "")}/games`;
  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;line-height:1.6;color:#e0d6c8;max-width:560px;margin:0 auto;padding:0;background:#0f0f1a">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:28px 24px;border-bottom:3px solid #c4a35a">
    <h1 style="color:#c4a35a;font-size:24px;margin:0">Welcome to the Literary Club</h1>
    <p style="color:#8a7e6b;font-size:12px;margin:8px 0 0;letter-spacing:2px;text-transform:uppercase">EbookGamez</p>
  </div>
  <div style="padding:28px 24px;background:#1a1a2e">
    <p>Thanks for subscribing. You'll get occasional updates on new ebooks, free browser games, and learning tools — no spam.</p>
    <ul>
      <li><a href="${config.siteUrl}/catalog" style="color:#c4a35a">Browse 600+ ebooks</a></li>
      <li><a href="${games}" style="color:#c4a35a">Play free browser games</a></li>
      <li><a href="${learnforgeGames}" style="color:#c4a35a">LearnForge skill games &amp; practice exams</a></li>
    </ul>
    <p style="font-size:13px;color:#8a7e6b">Reply to this email if you have questions.</p>
  </div>
</body>
</html>`;
}

function weeklyDigestHtml(config: NewsletterConfig): string {
  const catalog = `${config.siteUrl.replace(/\/$/, "")}/catalog`;
  const games = `${config.siteUrl.replace(/\/$/, "")}/games`;
  const learnforge = `${config.learnforgeUrl.replace(/\/$/, "")}/games`;
  return `<!DOCTYPE html>
<html>
<body style="font-family:Georgia,serif;line-height:1.6;color:#e0d6c8;max-width:560px;margin:0 auto;padding:24px;background:#1a1a2e">
  <h1 style="color:#c4a35a;font-size:20px">Literary Club weekly draft</h1>
  <p>Use this as a starting point for your Resend broadcast.</p>
  <ul>
    <li><strong>New catalog picks</strong> — highlight 2–3 titles</li>
    <li><strong>Free games</strong> — <a href="${games}" style="color:#c4a35a">ebookgamez.com/games</a></li>
    <li><strong>LearnForge</strong> — <a href="${learnforge}" style="color:#c4a35a">career &amp; school skill games</a></li>
  </ul>
  <p><a href="${catalog}" style="color:#c4a35a">Shop the catalog</a></p>
  <p style="font-size:13px;color:#8a7e6b">Partnership mail: Gmail + CC ebookgames@yahoo.com</p>
</body>
</html>`;
}

export async function subscribeNewsletter(
  email: string,
  source: string,
): Promise<
  | { ok: true }
  | { ok: false; reason: "not_configured" | "send_failed"; message: string }
> {
  const config = await getNewsletterConfig();
  if (!config) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Newsletter is not configured on this server yet.",
    };
  }

  await addToAudience(config, email, source);

  const payload: Record<string, unknown> = {
    from: config.from,
    to: [email],
    subject: "Welcome to the Literary Club — EbookGamez",
    html: welcomeHtml(config),
    reply_to: config.replyTo,
  };

  const result = await resendPost(config, "/emails", payload);
  if (!result.ok) {
    const err =
      typeof result.data === "object" &&
      result.data &&
      "message" in result.data &&
      typeof (result.data as { message: unknown }).message === "string"
        ? (result.data as { message: string }).message
        : `Resend error (${result.status})`;
    console.error("[Newsletter] Welcome email failed:", err);
    return {
      ok: false,
      reason: "send_failed",
      message: "Could not send welcome email. Please try again later.",
    };
  }

  return { ok: true };
}

export async function sendWeeklyDigest(): Promise<{ ok: boolean; error?: string }> {
  const config = await getNewsletterConfig();
  if (!config) return { ok: false, error: "Resend not configured" };

  const to =
    process.env.OWNER_NOTIFY_EMAIL?.trim() ||
    config.replyTo ||
    "ebookgames@yahoo.com";

  const result = await resendPost(config, "/emails", {
    from: config.from,
    to: [to],
    subject: "Literary Club weekly draft — ebooks, games & LearnForge",
    html: weeklyDigestHtml(config),
    reply_to: config.replyTo,
  });

  if (!result.ok) {
    const err =
      typeof result.data === "object" &&
      result.data &&
      "message" in result.data &&
      typeof (result.data as { message: unknown }).message === "string"
        ? (result.data as { message: string }).message
        : `Resend error (${result.status})`;
    return { ok: false, error: err };
  }
  return { ok: true };
}

const RL_WINDOW_MS = 60 * 60 * 1000;
const RL_MAX = 5;
const rlHits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rlHits.get(ip);
  if (!entry || now >= entry.resetAt) {
    rlHits.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RL_MAX;
}

function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || "unknown";
  return req.socket.remoteAddress ?? "unknown";
}

export function registerNewsletterRoutes(
  app: Express,
  isAdminAuthenticated: (req: Request) => boolean,
): void {
  app.post("/api/newsletter/subscribe", async (req: Request, res: Response) => {
    if (rateLimited(clientIp(req))) {
      res.status(429).json({ error: "Too many signup attempts. Try again later." });
      return;
    }

    const body = req.body as { email?: unknown; source?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const source =
      typeof body.source === "string" && body.source.trim()
        ? body.source.trim().slice(0, 80)
        : "ebookgamez";

    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }

    const result = await subscribeNewsletter(email, source);
    if (!result.ok) {
      const status = result.reason === "not_configured" ? 503 : 502;
      res.status(status).json({ error: result.message });
      return;
    }

    res.json({
      ok: true,
      message: "You're subscribed. Check your inbox for a welcome email.",
    });
  });

  app.get("/api/newsletter/status", (_req, res) => {
    res.json({ configured: isNewsletterConfiguredSync() });
  });

  app.post("/api/admin/outreach/weekly-digest", async (req: Request, res: Response) => {
    if (!isAdminAuthenticated(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await sendWeeklyDigest();
    if (!result.ok) {
      res.status(502).json({ ok: false, error: result.error });
      return;
    }

    const to =
      process.env.OWNER_NOTIFY_EMAIL?.trim() ||
      process.env.RESEND_REPLY_TO?.trim() ||
      "ebookgames@yahoo.com";

    res.json({ ok: true, message: `Weekly digest sent to ${to}` });
  });
}
