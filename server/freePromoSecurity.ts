/**
 * Free promo (GOOGLETEST) usage logging + unknown-IP alerts.
 */
import type { Request } from "express";
import { sql } from "drizzle-orm";
import { db } from "./storage";
import { promoUsages } from "@shared/schema";
import { getNewsletterConfig } from "./newsletter";

const FREE_PROMO_CODES = new Set(["GOOGLETEST"]);

let columnsReady: Promise<void> | null = null;

export function isFreePromoCode(code: string): boolean {
  return FREE_PROMO_CODES.has(code.toUpperCase().trim());
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  return req.socket?.remoteAddress || req.ip || "unknown";
}

export function getUserAgent(req: Request): string {
  const ua = req.headers["user-agent"];
  return (typeof ua === "string" ? ua : "").slice(0, 500) || "unknown";
}

function parseAllowlist(): string[] {
  const raw = process.env.FREE_PROMO_ALLOWED_IPS || process.env.GOOGLETEST_ALLOWED_IPS || "";
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isPrivateOrLocalIp(ip: string): boolean {
  const v = ip.replace(/^::ffff:/, "");
  if (v === "127.0.0.1" || v === "::1" || v === "localhost" || v === "unknown") return true;
  if (/^10\./.test(v)) return true;
  if (/^192\.168\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  return false;
}

/** Known = explicitly allowlisted. Local/private IPs are NOT auto-trusted on production. */
export function isKnownFreePromoIp(ip: string): boolean {
  const allow = parseAllowlist();
  if (allow.length === 0) {
    // No allowlist configured → every public IP is "unknown" (alert).
    // Localhost-only allowed without alert when NODE_ENV=development.
    if (process.env.NODE_ENV === "development" && isPrivateOrLocalIp(ip)) return true;
    return false;
  }
  const normalized = ip.replace(/^::ffff:/, "");
  return allow.some((a) => a === ip || a === normalized);
}

async function ensurePromoUsageColumns(): Promise<void> {
  if (!columnsReady) {
    columnsReady = (async () => {
      try {
        await db.execute(sql`ALTER TABLE promo_usages ADD COLUMN IF NOT EXISTS ip_address text`);
        await db.execute(sql`ALTER TABLE promo_usages ADD COLUMN IF NOT EXISTS user_agent text`);
        await db.execute(sql`ALTER TABLE promo_usages ADD COLUMN IF NOT EXISTS book_titles text`);
        await db.execute(sql`ALTER TABLE promo_usages ADD COLUMN IF NOT EXISTS unknown_source boolean DEFAULT false`);
        await db.execute(sql`ALTER TABLE promo_usages ADD COLUMN IF NOT EXISTS alert_sent boolean DEFAULT false`);
      } catch (err: any) {
        console.error("[FreePromo] Failed to ensure promo_usages columns:", err?.message || err);
      }
    })();
  }
  await columnsReady;
}

export type FreePromoUseParams = {
  req: Request;
  promoCode: string;
  orderId: number;
  sessionId: string;
  bookTitles: string[];
};

/**
 * Log GOOGLETEST checkout use. Email owner when IP is not allowlisted.
 * Never throws — checkout must still succeed.
 */
export async function recordFreePromoUseAndAlert(params: FreePromoUseParams): Promise<void> {
  const code = params.promoCode.toUpperCase().trim();
  if (!isFreePromoCode(code)) return;

  const ip = getClientIp(params.req);
  const userAgent = getUserAgent(params.req);
  const known = isKnownFreePromoIp(ip);
  const unknownSource = !known;
  const titles = params.bookTitles.filter(Boolean).slice(0, 20);
  const titlesStr = titles.join("; ").slice(0, 2000);

  console.warn(
    `[FreePromo] ${code} used order=#${params.orderId} ip=${ip} known=${known} books=${titles.length} ua=${userAgent.slice(0, 80)}`,
  );

  let alertSent = false;
  try {
    await ensurePromoUsageColumns();
    await db.insert(promoUsages).values({
      promoCode: code,
      customerEmail: "owner@ebookgamez.com",
      stripeSessionId: params.sessionId,
      orderTotal: "0.00",
      ipAddress: ip,
      userAgent,
      bookTitles: titlesStr,
      unknownSource,
      alertSent: false,
    });
  } catch (err: any) {
    // Fallback without new columns if ALTER failed on older deploy
    try {
      await db.insert(promoUsages).values({
        promoCode: code,
        customerEmail: `owner@ebookgamez.com|ip:${ip}`,
        stripeSessionId: params.sessionId,
        orderTotal: "0.00",
      });
    } catch (err2: any) {
      console.error("[FreePromo] Failed to log usage:", err2?.message || err?.message || err2);
    }
  }

  if (unknownSource) {
    try {
      alertSent = await sendUnknownFreePromoAlert({
        promoCode: code,
        ip,
        userAgent,
        orderId: params.orderId,
        sessionId: params.sessionId,
        bookTitles: titles,
      });
      if (alertSent) {
        try {
          await db.execute(sql`
            UPDATE promo_usages
            SET alert_sent = true
            WHERE stripe_session_id = ${params.sessionId}
          `);
        } catch {
          /* ignore */
        }
      }
    } catch (err: any) {
      console.error("[FreePromo] Alert email failed:", err?.message || err);
    }
  }
}

async function sendUnknownFreePromoAlert(opts: {
  promoCode: string;
  ip: string;
  userAgent: string;
  orderId: number;
  sessionId: string;
  bookTitles: string[];
}): Promise<boolean> {
  const config = await getNewsletterConfig();
  if (!config) {
    console.error("[FreePromo] Resend not configured — cannot send alert email");
    return false;
  }

  const to = [
    ...new Set(
      [
        process.env.OWNER_NOTIFY_EMAIL?.trim(),
        process.env.FREE_PROMO_ALERT_EMAIL?.trim(),
        "ebookgames@yahoo.com",
        "owner@ebookgamez.com",
      ].filter(Boolean) as string[],
    ),
  ];

  const bookList =
    opts.bookTitles.length > 0
      ? opts.bookTitles.map((t) => `• ${t}`).join("<br/>")
      : "(no titles recorded)";

  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #1a1a2e; color: #e0d6c8;">
      <h2 style="color: #e74c3c; margin-top: 0;">⚠ Free promo used from UNKNOWN IP</h2>
      <p style="color: #b0a898;">Someone used <strong style="color: #c4a35a;">${opts.promoCode}</strong> from an IP that is not on your allowlist.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="color: #8a7e6b; padding: 6px 0;">IP</td><td style="text-align: right; font-weight: bold;">${opts.ip}</td></tr>
        <tr><td style="color: #8a7e6b; padding: 6px 0;">Order</td><td style="text-align: right;">#${opts.orderId}</td></tr>
        <tr><td style="color: #8a7e6b; padding: 6px 0;">Session</td><td style="text-align: right; font-size: 12px;">${opts.sessionId}</td></tr>
        <tr><td style="color: #8a7e6b; padding: 6px 0;">Time (UTC)</td><td style="text-align: right;">${new Date().toISOString()}</td></tr>
      </table>
      <p style="color: #8a7e6b; font-size: 13px;"><strong>User-Agent</strong><br/>${opts.userAgent}</p>
      <p style="color: #8a7e6b; font-size: 13px;"><strong>Books in cart</strong><br/>${bookList}</p>
      <p style="color: #b0a898; font-size: 13px; margin-top: 20px;">
        Access was still granted only to <code>owner@ebookgamez.com</code> (strangers cannot download).
        Add this IP to <code>FREE_PROMO_ALLOWED_IPS</code> if it was you.
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from.includes("@") ? config.from : `EbookGamez <${config.from}>`,
      to,
      reply_to: config.replyTo || "ebookgames@yahoo.com",
      subject: `[EbookGamez] ALERT: ${opts.promoCode} used from unknown IP ${opts.ip}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[FreePromo] Resend alert failed HTTP ${res.status}: ${text.slice(0, 200)}`);
    return false;
  }
  console.log(`[FreePromo] Unknown-IP alert emailed to ${to.join(", ")}`);
  return true;
}
