import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/navbar";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/customer/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-16 max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-8"
        >
          {sent ? (
            <div className="text-center">
              <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
              <h1 className="text-2xl font-display text-white mb-3" data-testid="text-reset-sent">Check Your Email</h1>
              <p className="text-white/60 mb-6">
                If an account exists with <strong className="text-white">{email}</strong>, we've sent a password reset link. Check your inbox and spam folder.
              </p>
              <Link href="/login">
                <Button variant="outline" data-testid="button-back-to-login">
                  <ArrowLeft className="h-4 w-4 mr-2" />Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
                <h1 className="text-2xl font-display text-white" data-testid="text-forgot-title">Forgot Password</h1>
                <p className="text-white/60 mt-2">Enter your email and we'll send you a reset link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-white/70 mb-1 block">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    data-testid="input-forgot-email"
                    className="bg-background border-border"
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full" data-testid="button-forgot-submit">
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-primary text-sm hover:underline" data-testid="link-back-login">
                  <ArrowLeft className="h-3 w-3 inline mr-1" />Back to Sign In
                </Link>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
