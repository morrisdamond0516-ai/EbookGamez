import { Router } from "express";
import { requireSubscriptionAuth, subscriptionRateLimit } from "./subscriptionAuth";
import * as subscriptionService from "./subscriptionService";

const router = Router();

// GET /api/subscription/session/:sessionId
// Requires a valid OTP-verified subscription token. The verified email is
// checked against the Stripe session's customer_email so callers can only
// retrieve info for sessions they own. The response is restricted to
// non-sensitive plan-level fields only (see SessionPlanInfo in
// subscriptionService.ts) — customer email, Stripe customer ID, and payment
// method details are never included.
router.get(
  "/api/subscription/session/:sessionId",
  subscriptionRateLimit,
  requireSubscriptionAuth,
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        res.status(400).json({ error: "Session ID required" });
        return;
      }
      const verifiedEmail = (req as { verifiedEmail?: string }).verifiedEmail ?? "";
      const info = await subscriptionService.getSessionPlanInfo(sessionId, verifiedEmail);
      if (!info) {
        res.status(404).json({ error: "Plan info not found for session" });
        return;
      }
      res.json(info);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err?.code === "EMAIL_MISMATCH") {
        res.status(403).json({ error: "You are not authorised to view this session" });
        return;
      }
      console.error("Error fetching session plan info:", error);
      res.status(500).json({ error: "Failed to retrieve session info" });
    }
  },
);

export default router;
