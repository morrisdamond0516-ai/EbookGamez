import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, BookOpen, Download, Star, Sparkles, X, Loader2, Mail, TrendingUp, ArrowUpCircle, Zap, Gift, RotateCcw, ShieldCheck, AlertTriangle, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { getSubscriptionToken, getVerifiedEmail, setSubscriptionAuth, clearSubscriptionAuth, isEmailVerified, getAuthHeaders, handleAuthError } from "@/lib/subscription-auth";
import { trackSubscriptionBeginCheckout, trackSubscriptionChange, trackBillingIntervalSwitch } from "@/lib/analytics";

interface Plan {
  id: number;
  name: string;
  tier: string;
  monthlyPrice: string;
  annualPrice: string | null;
  readsPerMonth: number;
  downloadsPerMonth: number;
}

interface SubscriptionStatus {
  active: boolean;
  subscription?: any;
  plan?: Plan;
  usage?: { reads: number; downloads: number };
  rolloverCredits?: number;
  savingsTotalCents?: number;
  billingInterval?: string;
  upgradeNudge?: {
    shouldNudge: boolean;
    nextTierName: string;
    nextDownloads: number;
    nextPrice: string;
    message: string;
    usedDownloads: number;
    currentDownloads: number;
  } | null;
}

const TIER_COLORS: Record<string, string> = {
  lite: "border-zinc-500",
  reader: "border-blue-500",
  value: "border-emerald-500 ring-2 ring-emerald-500/20",
  premium: "border-purple-500",
  vip: "border-amber-500",
};

const TIER_BADGES: Record<string, { label: string; color: string }> = {
  value: { label: "BEST VALUE", color: "bg-emerald-500" },
  vip: { label: "MOST POPULAR", color: "bg-amber-500" },
};

const TIER_ICONS: Record<string, any> = {
  lite: BookOpen,
  reader: BookOpen,
  value: Star,
  premium: Sparkles,
  vip: Crown,
};

export default function Subscription() {
  const [email, setEmail] = useState(() => localStorage.getItem("ebgz_sub_email") || "");
  const [loadingPlan, setLoadingPlan] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchingTier, setSwitchingTier] = useState<number | null>(null);
  const [showTierSwitcher, setShowTierSwitcher] = useState(false);
  const [showMonthlyConfirm, setShowMonthlyConfirm] = useState(false);
  const [pendingTierPlan, setPendingTierPlan] = useState<Plan | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<number | null>(null);
  const [subPromoInput, setSubPromoInput] = useState("");
  const [showStatusCheck, setShowStatusCheck] = useState(false);
  const [statusEmail, setStatusEmail] = useState("");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState("");
  const [verified, setVerified] = useState(() => {
    const savedEmail = localStorage.getItem("ebgz_sub_email") || "";
    return savedEmail ? isEmailVerified(savedEmail) : false;
  });

  useEffect(() => {
    fetch("/api/subscription/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "pricing_page_view" }),
    }).catch(() => {});
  }, []);

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["/api/subscription/plans"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
  });

  const activeEmail = email || statusEmail;

  const { data: status, refetch: refetchStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/subscription/status", activeEmail],
    queryFn: async () => {
      if (!activeEmail || !verified) return { active: false };
      const res = await fetch(`/api/subscription/status/${encodeURIComponent(activeEmail)}`, {
        headers: { ...getAuthHeaders() },
      });
      if (res.status === 401) {
        const isAuthErr = await handleAuthError(res);
        if (isAuthErr) {
          setVerified(false);
          return { active: false };
        }
      }
      if (!res.ok) throw new Error("Failed to check status");
      return res.json();
    },
    enabled: !!activeEmail && activeEmail.includes("@") && verified,
  });

  const { data: activeCheckout, refetch: refetchCheckout } = useQuery({
    queryKey: ["/api/subscription/active-checkout", activeEmail],
    queryFn: async () => {
      if (!activeEmail) return { hasCheckout: false };
      const res = await fetch(`/api/subscription/active-checkout?email=${encodeURIComponent(activeEmail)}`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return { hasCheckout: false };
      return res.json();
    },
    enabled: !!activeEmail && !!status?.active && verified,
  });

  const handleSendOtp = async (targetEmail: string) => {
    if (!targetEmail || !targetEmail.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch("/api/subscription/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setPendingVerifyEmail(targetEmail);
        setOtpSent(true);
        setOtpCode("");
        toast({ title: "Verification code sent! Check your email." });
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
    if (!otpCode || otpCode.length < 6) {
      toast({ title: "Please enter the 6-digit code", variant: "destructive" });
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/subscription/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingVerifyEmail, code: otpCode }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setSubscriptionAuth(data.token, pendingVerifyEmail);
        setEmail(pendingVerifyEmail);
        localStorage.setItem("ebgz_sub_email", pendingVerifyEmail);
        setVerified(true);
        setOtpSent(false);
        setOtpCode("");
        setShowStatusCheck(false);
        toast({ title: "Email verified successfully!" });
        setTimeout(() => refetchStatus(), 100);
      } else {
        toast({ title: data.error || "Invalid code", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleReturnBook = async () => {
    if (!activeEmail) return;
    const res = await fetch("/api/subscription/return", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ email: activeEmail }),
    });
    if (res.status === 401) {
      setVerified(false);
      clearSubscriptionAuth();
      toast({ title: "Session expired. Please verify your email again.", variant: "destructive" });
      return;
    }
    if (res.ok) {
      refetchCheckout();
      refetchStatus();
    }
  };

  const proceedToCheckout = async (planId: number, userEmail: string, promoCode?: string) => {
    setLoadingPlan(planId);
    localStorage.setItem("ebgz_sub_email", userEmail);

    try {
      await fetch("/api/subscription/track-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "tier_clicked", email: userEmail, planId, metadata: { tier: plans.find(p => p.id === planId)?.tier, billingInterval } }),
      });

      const res = await fetch("/api/subscription/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email: userEmail, billingInterval, ...(promoCode ? { promoCode } : {}) }),
      });

      const data = await res.json();
      if (data.error) {
        toast({ title: data.error, variant: "destructive" });
      } else if (data.url) {
        const plan = plans.find(p => p.id === planId);
        if (plan) {
          const price = billingInterval === "annual" && plan.annualPrice
            ? parseFloat(plan.annualPrice)
            : parseFloat(plan.monthlyPrice);
          trackSubscriptionBeginCheckout({
            name: plan.name,
            tier: plan.tier,
            price,
            billingInterval,
          });
        }
        window.location.href = data.url;
      }
    } catch (err) {
      toast({ title: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSubscribe = async (planId: number) => {
    setPendingPlanId(planId);
    setTimeout(() => emailInputRef.current?.focus(), 100);
  };

  const handleEmailSubmit = async () => {
    if (!email || !email.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (pendingPlanId) {
      setPendingPlanId(null);
      await proceedToCheckout(pendingPlanId, email, subPromoInput.trim() || undefined);
    }
  };

  const handleSwitchToMonthly = () => {
    if (!activeEmail || !status?.plan) return;
    setShowMonthlyConfirm(true);
  };

  const handleConfirmSwitchToMonthly = async () => {
    setShowMonthlyConfirm(false);
    setSwitching(true);
    try {
      const res = await fetch("/api/subscription/switch-interval", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ targetInterval: "monthly" }),
      });
      if (res.status === 401) {
        setVerified(false);
        clearSubscriptionAuth();
        toast({ title: "Session expired. Please verify your email again.", variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Failed to switch to monthly billing", variant: "destructive" });
        return;
      }
      toast({ title: "Switched to monthly billing!", description: "Your plan now renews monthly. Any unused annual credit has been applied to future invoices." });
      const switchedPlan = status?.plan;
      if (switchedPlan) {
        const monthlyPrice = parseFloat(switchedPlan.monthlyPrice);
        const annualPrice = switchedPlan.annualPrice ? parseFloat(switchedPlan.annualPrice) : monthlyPrice * 10;
        trackBillingIntervalSwitch({
          planName: switchedPlan.name,
          tier: switchedPlan.tier,
          fromInterval: "annual",
          toInterval: "monthly",
          oldPrice: annualPrice,
          newPrice: monthlyPrice,
          annualSavings: monthlyPrice * 12 - annualPrice,
        });
      }
      refetchStatus();
    } catch {
      toast({ title: "Failed to switch billing interval", variant: "destructive" });
    } finally {
      setSwitching(false);
    }
  };

  const handleSwitchToAnnual = async () => {
    if (!activeEmail) return;
    const plan = status?.plan;
    if (!plan) return;
    const monthlyNum = parseFloat(plan.monthlyPrice);
    const annualNum = plan.annualPrice ? parseFloat(plan.annualPrice) : monthlyNum * 10;
    const savings = (monthlyNum * 12 - annualNum).toFixed(0);
    if (!confirm(`Switch your ${plan.name} Pass to annual billing? You'll be charged $${annualNum.toFixed(2)}/year (with a prorated credit for the remainder of your current month) and save $${savings}/year vs monthly.`)) return;

    setSwitching(true);
    try {
      const res = await fetch("/api/subscription/switch-interval", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ targetInterval: "annual" }),
      });
      if (res.status === 401) {
        setVerified(false);
        clearSubscriptionAuth();
        toast({ title: "Session expired. Please verify your email again.", variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || "Failed to switch to annual billing", variant: "destructive" });
        return;
      }
      toast({ title: "Switched to annual billing!", description: "Your plan now renews yearly with prorated credits applied." });
      trackBillingIntervalSwitch({
        planName: plan.name,
        tier: plan.tier,
        fromInterval: "monthly",
        toInterval: "annual",
        oldPrice: monthlyNum,
        newPrice: annualNum,
        annualSavings: monthlyNum * 12 - annualNum,
      });
      refetchStatus();
    } catch {
      toast({ title: "Failed to switch billing interval", variant: "destructive" });
    } finally {
      setSwitching(false);
    }
  };

  const handleSwitchTier = (targetPlan: Plan) => {
    setPendingTierPlan(targetPlan);
  };

  const handleConfirmSwitchTier = async () => {
    if (!pendingTierPlan) return;
    const targetPlan = pendingTierPlan;
    const isUpgrade = plans.findIndex(p => p.id === targetPlan.id) > plans.findIndex(p => p.id === status?.plan?.id);
    const action = isUpgrade ? "upgrade" : "downgrade";
    setPendingTierPlan(null);
    setSwitchingTier(targetPlan.id);
    try {
      const res = await fetch("/api/subscription/switch-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ targetPlanId: targetPlan.id }),
      });
      if (res.status === 401) {
        setVerified(false);
        clearSubscriptionAuth();
        toast({ title: "Session expired. Please verify your email again.", variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || `Failed to ${action} plan`, variant: "destructive" });
        return;
      }
      toast({ title: `Switched to ${targetPlan.name} Pass!`, description: "Your billing has been prorated. The change is effective immediately. A confirmation email has been sent." });
      const interval = status?.billingInterval || "monthly";
      const prevPrice = interval === "annual" && status?.plan?.annualPrice
        ? parseFloat(status.plan.annualPrice)
        : parseFloat(status?.plan?.monthlyPrice || "0");
      const newPrice = interval === "annual" && targetPlan.annualPrice
        ? parseFloat(targetPlan.annualPrice)
        : parseFloat(targetPlan.monthlyPrice);
      trackSubscriptionChange({
        previousPlan: status?.plan?.name || "",
        previousTier: status?.plan?.tier || "",
        newPlan: targetPlan.name,
        newTier: targetPlan.tier,
        priceDelta: parseFloat((newPrice - prevPrice).toFixed(2)),
        newPrice,
        billingInterval: interval,
        action,
      });
      setShowTierSwitcher(false);
      refetchStatus();
    } catch {
      toast({ title: "Failed to switch plan", variant: "destructive" });
    } finally {
      setSwitchingTier(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel? You'll still have access until the end of your current billing period.")) return;

    setCancelling(true);
    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email: activeEmail }),
      });
      if (res.status === 401) {
        setVerified(false);
        clearSubscriptionAuth();
        toast({ title: "Session expired. Please verify your email again.", variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (data.success) {
        toast({ title: data.message });
        refetchStatus();
      } else {
        toast({ title: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to cancel", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const handleStatusCheck = () => {
    if (statusEmail.includes("@")) {
      if (isEmailVerified(statusEmail)) {
        setEmail(statusEmail);
        localStorage.setItem("ebgz_sub_email", statusEmail);
        setVerified(true);
        setShowStatusCheck(false);
        refetchStatus();
      } else {
        handleSendOtp(statusEmail);
      }
    }
  };

  const handleLogout = () => {
    clearSubscriptionAuth();
    setVerified(false);
    setEmail("");
    setStatusEmail("");
    localStorage.removeItem("ebgz_sub_email");
  };

  const savingsDisplay = status?.savingsTotalCents ? (status.savingsTotalCents / 100).toFixed(2) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative py-20 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ fontFamily: "Cinzel, serif" }}
          >
            Read + Keep
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-3"
          >
            Read from our entire library of 545+ ebooks — then download your favorites to keep forever.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-sm text-primary/80 font-serif max-w-xl mx-auto mb-6"
          >
            Check out one book at a time from our full library. Read, return, and swap as much as you want. Each plan includes a set number of downloads to keep your favorites forever — even if you cancel.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={() => setShowStatusCheck(!showStatusCheck)}
              className="text-sm text-primary/70 hover:text-primary underline underline-offset-4 transition-colors"
              data-testid="link-check-status"
            >
              Already have a subscription? Check your status
            </button>
          </motion.div>

          {verified && activeEmail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">{activeEmail}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-muted-foreground hover:text-foreground ml-2 underline"
                data-testid="button-logout-subscription"
              >
                Sign out
              </button>
            </motion.div>
          )}

          <AnimatePresence>
            {showStatusCheck && !verified && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {!otpSent ? (
                  <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-md mx-auto mt-4">
                    <Input
                      type="email"
                      placeholder="Enter your subscription email"
                      value={statusEmail}
                      onChange={(e) => setStatusEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleStatusCheck()}
                      className="flex-1"
                      data-testid="input-status-email"
                    />
                    <Button
                      onClick={handleStatusCheck}
                      variant="outline"
                      disabled={otpSending}
                      data-testid="button-check-status"
                    >
                      {otpSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                      Verify Email
                    </Button>
                  </div>
                ) : (
                  <div className="max-w-sm mx-auto mt-4 space-y-3">
                    <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      Code sent to {pendingVerifyEmail}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                        className="flex-1 text-center text-lg tracking-widest"
                        data-testid="input-otp-code"
                      />
                      <Button
                        onClick={handleVerifyOtp}
                        disabled={otpVerifying || otpCode.length < 6}
                        data-testid="button-verify-otp"
                      >
                        {otpVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                      </Button>
                    </div>
                    <button
                      onClick={() => handleSendOtp(pendingVerifyEmail)}
                      disabled={otpSending}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                      data-testid="button-resend-otp"
                    >
                      Resend code
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <AnimatePresence>
        {pendingPlanId && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 pb-8"
          >
            <div className="max-w-md mx-auto bg-card border border-primary/30 rounded-xl p-6 text-center">
              <Mail className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Enter your email to continue</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your email is how we manage your {plans.find(p => p.id === pendingPlanId)?.name} Pass — it's your login for reading books online, downloading titles, and managing your subscription. No password needed.
              </p>
              <div className="flex gap-2 mb-3">
                <Input
                  ref={emailInputRef}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
                  className="flex-1"
                  data-testid="input-subscription-email"
                />
              </div>
              <div className="flex gap-2 mb-3">
                <Input
                  type="text"
                  placeholder="Promo code (optional)"
                  value={subPromoInput}
                  onChange={(e) => setSubPromoInput(e.target.value.toUpperCase())}
                  className="flex-1 font-mono text-sm"
                  data-testid="input-subscription-promo"
                />
              </div>
              <Button
                onClick={handleEmailSubmit}
                disabled={loadingPlan !== null}
                className="w-full"
                data-testid="button-continue-checkout"
              >
                {loadingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continue to Checkout
              </Button>
              <button
                onClick={() => setPendingPlanId(null)}
                className="text-xs text-muted-foreground mt-3 hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {status?.active && (
        <section className="px-4 pb-12">
          <div className="max-w-2xl mx-auto space-y-4">
            <Card className="border-emerald-500/50 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-5 h-5" />
                  Active Subscription — {status.plan?.name} Pass
                  {status.billingInterval === "annual" && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-2">Annual</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-background/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">1 at a time</div>
                    <div className="text-sm text-muted-foreground">Library Checkout</div>
                  </div>
                  <div className="bg-background/50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold">{status.usage?.downloads || 0} / {(status.plan?.downloadsPerMonth || 0) + (status.rolloverCredits || 0)}</div>
                    <div className="text-sm text-muted-foreground">Downloads Used</div>
                    {(status.rolloverCredits || 0) > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <RotateCcw className="w-3 h-3 text-blue-400" />
                        <span className="text-xs text-blue-400">+{status.rolloverCredits} rollover</span>
                      </div>
                    )}
                  </div>
                  {savingsDisplay && (
                    <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-400" data-testid="text-savings-total">${savingsDisplay}</div>
                      <div className="text-sm text-muted-foreground">You've Saved</div>
                    </div>
                  )}
                  <div className="bg-background/50 rounded-lg p-4 text-center">
                    <div className="text-sm font-medium">{status.subscription?.currentPeriodEnd ? new Date(status.subscription.currentPeriodEnd).toLocaleDateString() : "N/A"}</div>
                    <div className="text-sm text-muted-foreground">Renews</div>
                  </div>
                </div>

                {status.upgradeNudge?.shouldNudge && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-purple-500/10 to-amber-500/10 border border-purple-500/30 rounded-lg p-4"
                    data-testid="banner-upgrade-nudge"
                  >
                    <div className="flex items-start gap-3">
                      <ArrowUpCircle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-purple-300">Running low on downloads?</div>
                        <div className="text-sm text-muted-foreground mt-1">{status.upgradeNudge.message}</div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeCheckout?.hasCheckout && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-amber-300">Currently Checked Out</div>
                        <Link href={`/book/${activeCheckout.bookId}`}>
                          <span className="text-amber-400 hover:text-amber-300 underline cursor-pointer">{activeCheckout.bookTitle}</span>
                        </Link>
                      </div>
                      <Button size="sm" variant="outline" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10" onClick={handleReturnBook} data-testid="button-return-from-sub">
                        Return Book
                      </Button>
                    </div>
                  </div>
                )}
                {!activeCheckout?.hasCheckout && status?.active && (
                  <div className="bg-background/50 rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">No book checked out — browse our catalog to check one out!</p>
                    <Link href="/">
                      <Button size="sm" variant="link" className="text-amber-400 mt-1" data-testid="button-browse-books">Browse Books</Button>
                    </Link>
                  </div>
                )}
                {status.subscription?.cancelledAt && (
                  <div className="text-amber-400 text-sm">Cancellation scheduled — access continues until end of billing period</div>
                )}
                {!status.subscription?.cancelledAt && status.billingInterval !== "annual" && status.plan?.annualPrice && (() => {
                  const monthlyNum = parseFloat(status.plan.monthlyPrice);
                  const annualNum = parseFloat(status.plan.annualPrice);
                  const savings = (monthlyNum * 12 - annualNum).toFixed(0);
                  return (
                    <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/30 rounded-lg p-4" data-testid="banner-switch-to-annual">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3 flex-1 min-w-[200px]">
                          <Gift className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-amber-300">Save ${savings}/year with annual billing</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Switch to ${annualNum.toFixed(2)}/year (${(annualNum / 12).toFixed(2)}/mo equivalent) — get 2 months free. We'll prorate your remaining monthly balance as a credit.
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={handleSwitchToAnnual}
                          disabled={switching}
                          data-testid="button-switch-to-annual"
                        >
                          {switching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Switch to Annual
                        </Button>
                      </div>
                    </div>
                  );
                })()}
                {!status.subscription?.cancelledAt && status.billingInterval === "annual" && (
                  <div className="bg-background/50 border border-border rounded-lg p-4" data-testid="banner-switch-to-monthly">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3 flex-1 min-w-[200px]">
                        <RotateCcw className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium">Switch to monthly billing</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Change to ${status.plan?.monthlyPrice}/month. Any unused time from your current annual period will be credited as a prorated amount toward future invoices.
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSwitchToMonthly}
                        disabled={switching}
                        data-testid="button-switch-to-monthly"
                      >
                        {switching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Switch to Monthly
                      </Button>
                    </div>
                  </div>
                )}
                {!status.subscription?.cancelledAt && plans.filter(p => p.id !== status.plan?.id).length > 0 && (
                  <div data-testid="section-change-plan">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTierSwitcher(v => !v)}
                      data-testid="button-toggle-tier-switcher"
                    >
                      Change Plan
                    </Button>
                    <AnimatePresence>
                      {showTierSwitcher && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mt-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {plans.map((plan) => {
                              const isCurrent = plan.id === status.plan?.id;
                              const displayPrice = status.billingInterval === "annual" && plan.annualPrice
                                ? `$${(parseFloat(plan.annualPrice) / 12).toFixed(2)}/mo`
                                : `$${plan.monthlyPrice}/mo`;
                              const isUpgrade = plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === status.plan?.id);
                              return (
                                <div
                                  key={plan.id}
                                  className={`rounded-lg border p-3 text-center ${isCurrent ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-background/50"}`}
                                  data-testid={`card-tier-option-${plan.tier}`}
                                >
                                  <div className="text-sm font-semibold">{plan.name} Pass</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">{displayPrice}</div>
                                  <div className="text-xs text-muted-foreground">{plan.downloadsPerMonth} dl/mo</div>
                                  {isCurrent ? (
                                    <div className="text-xs text-emerald-400 font-medium mt-2">Current Plan</div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant={isUpgrade ? "default" : "outline"}
                                      className={`w-full mt-2 text-xs h-7 ${isUpgrade ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                                      onClick={() => handleSwitchTier(plan)}
                                      disabled={switchingTier !== null}
                                      data-testid={`button-switch-to-${plan.tier}`}
                                    >
                                      {switchingTier === plan.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : isUpgrade ? "Upgrade" : "Downgrade"}
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">Changes take effect immediately with prorated billing.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                {!status.subscription?.cancelledAt && (
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling} data-testid="button-cancel-subscription">
                    {cancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Cancel Subscription
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <section className="px-4 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center bg-card border border-border rounded-full p-1" data-testid="toggle-billing-interval">
              <button
                onClick={() => setBillingInterval("monthly")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${billingInterval === "monthly" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="button-billing-monthly"
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval("annual")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all relative ${billingInterval === "annual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid="button-billing-annual"
              >
                Annual
                <span className="absolute -top-2.5 -right-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  2 FREE
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {plans.map((plan, index) => {
              const Icon = TIER_ICONS[plan.tier] || BookOpen;
              const badge = TIER_BADGES[plan.tier];
              const borderColor = TIER_COLORS[plan.tier] || "border-border";
              const isValue = plan.tier === "value";
              const monthlyNum = parseFloat(plan.monthlyPrice);
              const annualNum = plan.annualPrice ? parseFloat(plan.annualPrice) : monthlyNum * 10;
              const annualMonthly = (annualNum / 12).toFixed(2);
              const displayPrice = billingInterval === "annual" ? annualMonthly : plan.monthlyPrice;
              const isTrialTier = plan.tier === "value" && billingInterval === "monthly";

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  {badge && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${badge.color} text-white text-xs font-bold px-3 py-1 rounded-full z-10`}>
                      {badge.label}
                    </div>
                  )}
                  <Card className={`h-full ${borderColor} ${isValue ? "scale-105 shadow-xl shadow-emerald-500/10" : ""} transition-all hover:scale-[1.02]`} data-testid={`card-plan-${plan.tier}`}>
                    <CardHeader className="text-center pb-2">
                      <Icon className={`w-8 h-8 mx-auto mb-2 ${plan.tier === "vip" ? "text-amber-400" : plan.tier === "premium" ? "text-purple-400" : plan.tier === "value" ? "text-emerald-400" : "text-muted-foreground"}`} />
                      <CardTitle className="text-lg">{plan.name} Pass</CardTitle>
                      <div className="mt-2">
                        <span className="text-3xl font-bold">${displayPrice}</span>
                        <span className="text-muted-foreground text-sm">/mo</span>
                      </div>
                      {billingInterval === "annual" && (
                        <div className="mt-1">
                          <span className="text-xs text-muted-foreground line-through">${plan.monthlyPrice}/mo</span>
                          <span className="text-xs text-emerald-400 ml-2">Save ${(monthlyNum * 12 - annualNum).toFixed(0)}/yr</span>
                        </div>
                      )}
                      {billingInterval === "annual" && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Billed ${annualNum.toFixed(2)}/year
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-3 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Library checkout — 1 book at a time</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {plan.downloadsPerMonth > 0 ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>Download & keep <strong>{plan.downloadsPerMonth}</strong> {plan.downloadsPerMonth === 1 ? "book" : "books"} included with your plan</span>
                            </>
                          ) : (
                            <>
                              <X className="w-4 h-4 text-zinc-600 shrink-0" />
                              <span className="text-muted-foreground">Online reading only</span>
                            </>
                          )}
                        </li>
                        <li className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-blue-400 shrink-0" />
                          <span>Unused downloads roll over</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>545+ book library</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Downloads are yours forever</span>
                        </li>
                        {(plan.tier === "premium" || plan.tier === "vip") && (
                          <li className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Early access to new titles</span>
                          </li>
                        )}
                      </ul>

                      {isTrialTier && (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2" data-testid="badge-free-trial">
                          <Gift className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs text-emerald-400 font-medium">7-day free trial for new subscribers</span>
                        </div>
                      )}

                      <div className="pt-2 text-center text-xs text-muted-foreground">
                        {plan.downloadsPerMonth} {plan.downloadsPerMonth === 1 ? "download" : "downloads"} included with this plan
                      </div>

                      <Button
                        className={`w-full ${isValue ? "bg-emerald-600 hover:bg-emerald-700" : plan.tier === "vip" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                        onClick={() => handleSubscribe(plan.id)}
                        disabled={loadingPlan !== null || (status?.active && !status?.subscription?.cancelledAt)}
                        data-testid={`button-subscribe-${plan.tier}`}
                      >
                        {loadingPlan === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        {status?.active ? "Already Subscribed" : isTrialTier ? "Start Free Trial" : "Get Started"}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-12 max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="text-center p-6 bg-card rounded-xl border border-border">
                <RotateCcw className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Rollover Credits</h3>
                <p className="text-sm text-muted-foreground">Unused download credits carry over to next month, up to your plan's monthly limit.</p>
              </div>
              <div className="text-center p-6 bg-card rounded-xl border border-border">
                <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Savings Tracker</h3>
                <p className="text-sm text-muted-foreground">See exactly how much you've saved compared to buying each book individually.</p>
              </div>
              <div className="text-center p-6 bg-card rounded-xl border border-border">
                <Zap className="w-8 h-8 text-amber-400 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Annual Discount</h3>
                <p className="text-sm text-muted-foreground">Save 2 months free when you choose annual billing on any plan.</p>
              </div>
            </div>
          </div>

          <div className="mt-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8" style={{ fontFamily: "Cinzel, serif" }}>
              Frequently Asked Questions
            </h2>
            <div className="space-y-6 text-sm">
              <div>
                <h3 className="font-semibold text-base mb-1">What's included with every plan?</h3>
                <p className="text-muted-foreground">Every plan works like a library — <strong className="text-white">check out one book at a time</strong> to read online. When you're done, return it and check out another. Your plan also includes a set number of <strong className="text-white">downloads</strong> to keep books permanently. Downloaded books are yours to keep forever, even if you cancel.</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">Do unused downloads carry over?</h3>
                <p className="text-muted-foreground">Yes! Unused download credits roll over to the next billing period, up to your plan's monthly limit. For example, if your Value plan includes 3 downloads and you only use 1, you'll have up to 3 rollover credits added to your next month's 3 — giving you up to 6 total.</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">How does the free trial work?</h3>
                <p className="text-muted-foreground">New subscribers can try the Value plan free for 7 days. You'll get full access to the library and 3 download credits. If you don't cancel before the trial ends, your card will be charged the regular monthly rate.</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">What happens if I cancel?</h3>
                <p className="text-muted-foreground">Online reading access ends when your subscription expires, but every book you've downloaded is yours to keep forever. Your personal library stays with you no matter what.</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">How do downloads work?</h3>
                <p className="text-muted-foreground">Check out a book and read it online. When you find one you love, use one of your included downloads to keep it as a DRM-free EPUB file — yours forever. The number of downloads depends on the plan you choose. Return your current book anytime to check out a new one.</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">What's the annual discount?</h3>
                <p className="text-muted-foreground">Choose annual billing on any plan and get 2 months free — that's the equivalent of paying for only 10 months out of 12. All the same features, just a better price.</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">Can I still buy individual books?</h3>
                <p className="text-muted-foreground">Absolutely. The subscription is an optional way to save if you read multiple books per month. Individual purchases are always available.</p>
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">Can I upgrade or downgrade my plan?</h3>
                <p className="text-muted-foreground">Yes! You can switch between any plan tier at any time without cancelling. Just click "Change Plan" on your active subscription card and pick a new tier. Your billing is prorated — if you upgrade mid-month, you only pay the difference; if you downgrade, you get a credit toward your next bill.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Annual → Monthly switch warning dialog (#31) */}
      <Dialog open={showMonthlyConfirm} onOpenChange={setShowMonthlyConfirm}>
        <DialogContent className="max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Switching to Monthly Billing
            </DialogTitle>
            <DialogDescription>Review what changes before confirming.</DialogDescription>
          </DialogHeader>
          {status?.plan && (() => {
            const plan = status.plan!;
            const monthlyNum = parseFloat(plan.monthlyPrice);
            const annualNum = plan.annualPrice ? parseFloat(plan.annualPrice) : monthlyNum * 10;
            const annualSavings = (monthlyNum * 12 - annualNum).toFixed(2);
            const monthlyEquivalent = (annualNum / 12).toFixed(2);
            return (
              <div className="space-y-4 py-2">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Annual savings you'll give up
                  </p>
                  <p className="text-2xl font-bold text-amber-400">${annualSavings}/year</p>
                  <p className="text-xs text-muted-foreground">
                    Currently paying ${monthlyEquivalent}/mo (annual rate) → switching to ${plan.monthlyPrice}/mo
                  </p>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>New monthly price</span>
                    <span className="text-foreground font-medium">${plan.monthlyPrice}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Annual equivalent</span>
                    <span className="text-foreground font-medium">${(monthlyNum * 12).toFixed(2)}/year</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                  Any unused time from your current annual period will be credited as a prorated amount toward future invoices.
                </p>
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMonthlyConfirm(false)} className="border-white/20">Keep Annual</Button>
            <Button onClick={handleConfirmSwitchToMonthly} disabled={switching} className="bg-amber-600 hover:bg-amber-700">
              {switching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Switch to Monthly
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tier switch proration preview dialog (#34) */}
      <Dialog open={!!pendingTierPlan} onOpenChange={(open) => { if (!open) setPendingTierPlan(null); }}>
        <DialogContent className="max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {pendingTierPlan && plans.findIndex(p => p.id === pendingTierPlan.id) > plans.findIndex(p => p.id === status?.plan?.id) ? "Upgrade" : "Change"} Plan
            </DialogTitle>
            <DialogDescription>Review your new plan details before confirming.</DialogDescription>
          </DialogHeader>
          {pendingTierPlan && (() => {
            const isUpgrade = plans.findIndex(p => p.id === pendingTierPlan.id) > plans.findIndex(p => p.id === status?.plan?.id);
            const isAnnual = status?.billingInterval === "annual";
            const newMonthlyPrice = parseFloat(pendingTierPlan.monthlyPrice);
            const newAnnualPrice = pendingTierPlan.annualPrice ? parseFloat(pendingTierPlan.annualPrice) : newMonthlyPrice * 10;
            const displayPrice = isAnnual && pendingTierPlan.annualPrice
              ? `$${newAnnualPrice.toFixed(2)}/year ($${(newAnnualPrice / 12).toFixed(2)}/mo)`
              : `$${pendingTierPlan.monthlyPrice}/month`;

            const periodEnd = status?.subscription?.currentPeriodEnd ? new Date(status.subscription.currentPeriodEnd) : null;
            const daysRemaining = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86400000)) : null;
            const totalDays = isAnnual ? 365 : 30;
            const fractionRemaining = daysRemaining !== null ? daysRemaining / totalDays : null;
            const currentPlanPrice = isAnnual && status?.plan?.annualPrice
              ? parseFloat(status.plan.annualPrice)
              : parseFloat(status?.plan?.monthlyPrice || "0");
            const estimatedCredit = fractionRemaining !== null ? (currentPlanPrice * fractionRemaining).toFixed(2) : null;
            const estimatedCharge = fractionRemaining !== null
              ? ((isAnnual && pendingTierPlan.annualPrice ? newAnnualPrice : newMonthlyPrice) * fractionRemaining).toFixed(2)
              : null;

            return (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs mb-1">Current</div>
                    <div className="font-semibold">{status?.plan?.name} Pass</div>
                    <div className="text-muted-foreground text-xs">{status?.plan?.downloadsPerMonth} downloads/mo</div>
                  </div>
                  <div className={`rounded-lg p-3 border ${isUpgrade ? "bg-purple-500/10 border-purple-500/30" : "bg-muted/30 border-border"}`}>
                    <div className="text-muted-foreground text-xs mb-1">{isUpgrade ? "Upgrading to" : "Changing to"}</div>
                    <div className="font-semibold">{pendingTierPlan.name} Pass</div>
                    <div className="text-muted-foreground text-xs">{pendingTierPlan.downloadsPerMonth} downloads/mo</div>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New price</span>
                    <span className="font-medium">{displayPrice}</span>
                  </div>
                  {estimatedCredit && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Estimated credit ({daysRemaining}d remaining)</span>
                      <span>−${estimatedCredit}</span>
                    </div>
                  )}
                  {estimatedCharge && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prorated charge</span>
                      <span className="font-medium">${estimatedCharge}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                  The change takes effect immediately. Billing is prorated — you only pay (or receive credit) for the remaining time in your current period. A confirmation email will be sent.
                </p>
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingTierPlan(null)} className="border-white/20">Cancel</Button>
            <Button
              onClick={handleConfirmSwitchTier}
              disabled={switchingTier !== null}
              className={pendingTierPlan && plans.findIndex(p => p.id === pendingTierPlan.id) > plans.findIndex(p => p.id === status?.plan?.id) ? "bg-purple-600 hover:bg-purple-700" : ""}
              data-testid="button-confirm-tier-switch"
            >
              {switchingTier !== null ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
