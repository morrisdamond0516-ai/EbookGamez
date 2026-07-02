import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useSearch } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Check, BookOpen, ArrowRight, Loader2, Mail, KeyRound, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { trackSubscriptionPurchase } from "@/lib/analytics";
import {
  getSubscriptionToken,
  setSubscriptionAuth,
  clearSubscriptionAuth,
} from "@/lib/subscription-auth";
import { useToast } from "@/hooks/use-toast";

interface SessionPlanInfo {
  tier: string;
  billingInterval: "monthly" | "annual";
  planName: string;
  monthlyPrice: string;
  annualPrice: string | null;
}

interface Plan {
  id: number;
  name: string;
  tier: string;
  monthlyPrice: string;
  annualPrice: string | null;
  readsPerMonth: number;
  downloadsPerMonth: number;
}

type Step = "loading" | "otp-email" | "otp-code" | "done" | "no-session";

export default function SubscriptionSuccess() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const sessionId = params.get("session_id") || "";
  const tierParam = params.get("tier") || "";
  const billingParam = params.get("billing") || "";
  const billing: "monthly" | "annual" = billingParam === "annual" ? "annual" : "monthly";

  const { toast } = useToast();
  const codeInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("loading");
  const [otpEmail, setOtpEmail] = useState(
    () => localStorage.getItem("ebgz_sub_email") || "",
  );
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [planInfo, setPlanInfo] = useState<SessionPlanInfo | null>(null);

  const fetchSessionInfo = async (token: string): Promise<boolean> => {
    if (!sessionId) return false;
    try {
      const res = await fetch(`/api/subscription/session/${sessionId}`, {
        headers: { "X-Subscription-Token": token },
      });
      if (res.ok) {
        const data: SessionPlanInfo = await res.json();
        setPlanInfo(data);
        setStep("done");
        return true;
      }
      if (res.status === 401 || res.status === 403) {
        clearSubscriptionAuth();
      }
    } catch {
    }
    return false;
  };

  useEffect(() => {
    if (!sessionId) {
      setStep("no-session");
      return;
    }
    const token = getSubscriptionToken();
    if (token) {
      fetchSessionInfo(token).then((ok) => {
        if (!ok) setStep("otp-email");
      });
    } else {
      setStep("otp-email");
    }
  }, [sessionId]);

  useEffect(() => {
    fetch("/api/subscription/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "subscription_success_page" }),
    }).catch(() => {});
  }, [sessionId]);

  const { data: plans = [], isFetched: plansFetched } = useQuery<Plan[]>({
    queryKey: ["/api/subscription/plans"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
    retry: 2,
  });

  useEffect(() => {
    if (!sessionId || !plansFetched) return;
    const plan = plans.find((p) => p.tier === tierParam) ?? null;
    const dedupKey = `ebgz_sub_conv_tracked_${sessionId}`;
    if (localStorage.getItem(dedupKey)) return;
    localStorage.setItem(dedupKey, "1");

    if (plan) {
      const value =
        billing === "annual" && plan.annualPrice
          ? parseFloat(plan.annualPrice)
          : parseFloat(plan.monthlyPrice);
      trackSubscriptionPurchase({
        sessionId,
        planName: plan.name,
        tier: plan.tier,
        value,
        billingInterval: billing,
      });
    } else {
      trackSubscriptionPurchase({
        sessionId,
        planName: tierParam
          ? `${tierParam.charAt(0).toUpperCase()}${tierParam.slice(1)}`
          : "Reading Pass",
        tier: tierParam || "unknown",
        value: 0,
        billingInterval: billing,
      });
    }
  }, [sessionId, plansFetched, plans, tierParam, billing]);

  const handleSendOtp = async () => {
    const email = otpEmail.trim();
    if (!email || !email.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch("/api/subscription/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setPendingEmail(email);
        setOtpCode("");
        setStep("otp-code");
        toast({ title: "Verification code sent! Check your inbox." });
        setTimeout(() => codeInputRef.current?.focus(), 100);
      } else {
        toast({ title: data.error || "Failed to send code", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to send verification code", variant: "destructive" });
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      toast({ title: "Please enter the 6-digit code", variant: "destructive" });
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/subscription/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, code: otpCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setSubscriptionAuth(data.token, pendingEmail);
        localStorage.setItem("ebgz_sub_email", pendingEmail);
        const ok = await fetchSessionInfo(data.token);
        if (!ok) {
          toast({
            title: "Verified, but could not load plan details",
            description: "Check your email for subscription confirmation.",
            variant: "destructive",
          });
          setStep("no-session");
        }
      } else {
        toast({ title: data.error || "Invalid code", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setOtpVerifying(false);
    }
  };

  const displayPrice =
    planInfo?.billingInterval === "annual" && planInfo?.annualPrice
      ? `$${parseFloat(planInfo.annualPrice).toFixed(2)}/yr`
      : planInfo?.monthlyPrice
      ? `$${parseFloat(planInfo.monthlyPrice).toFixed(2)}/mo`
      : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <Check className="w-10 h-10 text-emerald-400" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold mb-4"
            style={{ fontFamily: "Cinzel, serif" }}
            data-testid="text-subscription-success-title"
          >
            Welcome to EbookGamez Reading Pass!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground mb-8"
            data-testid="text-subscription-success-message"
          >
            Your subscription is now active. Start exploring our library of 545+ ebooks right away.
          </motion.p>

          {/* Plan details — gated behind email verification */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-6"
          >
            {step === "loading" && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-3" data-testid="status-plan-loading">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading plan details…</span>
              </div>
            )}

            {step === "otp-email" && (
              <Card className="text-left" data-testid="card-otp-email">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground text-sm">Verify your email to see plan details</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Enter the email you used at checkout to confirm your subscription.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                      className="flex-1"
                      data-testid="input-otp-email"
                    />
                    <Button
                      onClick={handleSendOtp}
                      disabled={otpSending}
                      data-testid="button-send-otp"
                    >
                      {otpSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Send Code"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === "otp-code" && (
              <Card className="text-left" data-testid="card-otp-code">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <KeyRound className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground text-sm">Enter your verification code</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        We sent a 6-digit code to <span className="text-foreground">{pendingEmail}</span>.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      ref={codeInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="123456"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                      className="flex-1 tracking-widest font-mono text-center"
                      data-testid="input-otp-code"
                    />
                    <Button
                      onClick={handleVerifyOtp}
                      disabled={otpVerifying}
                      data-testid="button-verify-otp"
                    >
                      {otpVerifying ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </div>
                  <button
                    onClick={() => setStep("otp-email")}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    data-testid="button-resend-otp"
                  >
                    Use a different email or resend code
                  </button>
                </CardContent>
              </Card>
            )}

            {step === "done" && planInfo && (
              <div
                className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground"
                data-testid="container-plan-details"
              >
                <span data-testid="text-plan-name">
                  <span className="text-foreground font-medium">{planInfo.planName} Pass</span>
                </span>
                <span>·</span>
                <span className="capitalize" data-testid="text-billing-interval">
                  {planInfo.billingInterval}
                </span>
                {displayPrice && (
                  <>
                    <span>·</span>
                    <span data-testid="text-plan-price">{displayPrice}</span>
                  </>
                )}
              </div>
            )}

            {step === "no-session" && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm" data-testid="text-plan-details-unavailable">
                <AlertCircle className="w-4 h-4" />
                <span>Plan details unavailable — check your email for confirmation.</span>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="mb-8">
              <CardContent className="pt-6 space-y-3 text-left text-sm">
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>Check your email for a confirmation from Stripe with your subscription details</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>Visit the subscription page anytime to check your usage and manage your plan</span>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>Browse our catalog and start reading — your reads are tracked automatically</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/catalog">
                <Button size="lg" data-testid="button-browse-catalog">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Browse Catalog
                </Button>
              </Link>
              <Link href="/subscription">
                <Button variant="outline" size="lg" data-testid="button-view-subscription">
                  View My Subscription
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
