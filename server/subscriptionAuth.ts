import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

interface OTPEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

interface SessionEntry {
  email: string;
  expiresAt: number;
}

const otpStore = new Map<string, OTPEntry>();
const sessionStore = new Map<string, SessionEntry>();

setInterval(() => {
  const now = Date.now();
  otpStore.forEach((entry, key) => {
    if (entry.expiresAt < now) otpStore.delete(key);
  });
  sessionStore.forEach((entry, key) => {
    if (entry.expiresAt < now) sessionStore.delete(key);
  });
}, 60 * 1000);

export function generateOTP(email: string): string {
  const normalizedEmail = email.toLowerCase().trim();
  const code = crypto.randomInt(100000, 999999).toString();
  otpStore.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });
  return code;
}

export function verifyOTP(email: string, code: string): { valid: boolean; token?: string; error?: string } {
  const normalizedEmail = email.toLowerCase().trim();
  const entry = otpStore.get(normalizedEmail);

  if (!entry) {
    return { valid: false, error: "No verification code found. Please request a new one." };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { valid: false, error: "Verification code has expired. Please request a new one." };
  }

  entry.attempts++;
  if (entry.attempts > MAX_OTP_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return { valid: false, error: "Too many failed attempts. Please request a new code." };
  }

  if (entry.code !== code.trim()) {
    return { valid: false, error: `Invalid code. ${MAX_OTP_ATTEMPTS - entry.attempts} attempts remaining.` };
  }

  otpStore.delete(normalizedEmail);

  const token = crypto.randomBytes(32).toString("hex");
  sessionStore.set(token, {
    email: normalizedEmail,
    expiresAt: Date.now() + SESSION_EXPIRY_MS,
  });

  return { valid: true, token };
}

export function validateSession(token: string): string | null {
  const entry = sessionStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessionStore.delete(token);
    return null;
  }
  return entry.email;
}

export function revokeSession(token: string): void {
  sessionStore.delete(token);
}

export function requireSubscriptionAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-subscription-token"] as string;

  if (!token) {
    return res.status(401).json({
      error: "Email verification required",
      code: "AUTH_REQUIRED",
    });
  }

  const email = validateSession(token);
  if (!email) {
    return res.status(401).json({
      error: "Session expired. Please verify your email again.",
      code: "SESSION_EXPIRED",
    });
  }

  const bodyEmail = req.body?.email?.toLowerCase?.()?.trim?.();
  const paramEmail = req.params?.email?.toLowerCase?.()?.trim?.();
  const queryEmail = (req.query?.email as string)?.toLowerCase?.()?.trim?.();
  const requestEmail = bodyEmail || paramEmail || queryEmail;

  if (requestEmail && requestEmail !== email) {
    return res.status(403).json({
      error: "Email mismatch. You can only perform actions for your verified email.",
      code: "EMAIL_MISMATCH",
    });
  }

  (req as any).verifiedEmail = email;
  next();
}

export const subscriptionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

export const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please wait before trying again." },
});

export const sensitiveActionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
