import { useState, useEffect } from "react";
import { Copy, Check, Mail, ExternalLink, Send, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RequireAdminToken } from "@/components/require-admin-token";
import { OUTREACH } from "@/lib/outreach-constants";
import { OUTREACH_TEMPLATES } from "@/lib/outreach-templates";

function AdminOutreachMain() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [resendOk, setResendOk] = useState<boolean | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const token = typeof window !== "undefined" ? localStorage.getItem("ebgz_admin_token") || "" : "";

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/newsletter/status");
        const data = (await res.json()) as { configured?: boolean };
        setResendOk(!!data.configured);
      } catch {
        setResendOk(false);
      }
    })();
  }, []);

  async function copyTemplate(id: string, subject: string, body: string) {
    const full = `Subject: ${subject}\n\nCC: ${OUTREACH.yahooEmail}\n\n${body}`;
    await navigator.clipboard.writeText(full);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied", description: "Paste into Gmail. CC Yahoo is in the header." });
  }

  async function sendWeeklyDigest() {
    setDigestLoading(true);
    try {
      const res = await fetch("/api/admin/outreach/weekly-digest", {
        method: "POST",
        headers: { "x-admin-token": token },
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) {
        toast({
          title: "Could not send digest",
          description: data.error ?? "Check Resend on the server.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Digest sent",
        description: data.message ?? `Check ${OUTREACH.yahooEmail}`,
      });
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setDigestLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto max-w-3xl space-y-8 px-4 py-12">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="font-serif">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Admin
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="font-display text-3xl text-primary">Outreach &amp; email hub</h1>
          <p className="mt-2 font-serif text-muted-foreground">
            Partnership mail via <strong>Gmail</strong> (CC {OUTREACH.yahooEmail}). Literary Club via{" "}
            <strong>Resend</strong>.
          </p>
        </div>

        <Card className="border-white/10 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-primary">
              <Mail className="h-5 w-5" />
              Quick status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant={resendOk ? "default" : "secondary"}>
              Resend: {resendOk === null ? "…" : resendOk ? "configured" : "not configured"}
            </Badge>
            <Badge variant="outline">Gmail MCP: Cursor setup (docs/email-setup-guide.md)</Badge>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="font-display text-xl text-foreground">Partnership emails (copy → Gmail)</h2>
          <p className="text-sm font-serif text-muted-foreground">
            Send from Gmail. Always CC <strong>{OUTREACH.yahooEmail}</strong>.
          </p>
          {OUTREACH_TEMPLATES.map((t) => {
            const body = t.body(origin);
            return (
              <Card key={t.id} className="border-white/10 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-base">{t.org}</CardTitle>
                  <CardDescription className="font-serif">
                    <a
                      href={t.where.split(" ")[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline"
                    >
                      {t.where}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm font-medium">Subject: {t.subject}</p>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-black/40 p-3 text-xs whitespace-pre-wrap font-mono">
                    {body}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-serif"
                    onClick={() => copyTemplate(t.id, t.subject, body)}
                  >
                    {copiedId === t.id ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    Copy for Gmail
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="border-white/10 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-primary">
              <Send className="h-5 w-5" />
              Weekly Literary Club draft
            </CardTitle>
            <CardDescription className="font-serif">
              Emails a draft update to {OUTREACH.yahooEmail} via Resend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={sendWeeklyDigest}
              disabled={digestLoading || resendOk === false}
              className="font-serif"
            >
              {digestLoading ? "Sending…" : "Email me this week's digest"}
            </Button>
            {resendOk === false ? (
              <p className="mt-2 text-sm text-destructive">
                Connect Resend on Replit or set RESEND_API_KEY + RESEND_FROM.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/50">
          <CardHeader>
            <CardTitle className="font-display">Gmail + Cursor (one-time)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-serif text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Copy <code className="text-xs">docs/mcp-gmail.example.json</code> into Cursor MCP settings.</li>
              <li>Run <code className="text-xs">npx gmail-mcp-server setup</code> and sign in with Google once.</li>
              <li>
                In Cursor: &quot;Draft the SCORE email, CC {OUTREACH.yahooEmail}, do not send.&quot;
              </li>
            </ol>
            <p>Full guide: <code className="text-xs">docs/email-setup-guide.md</code></p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}

export default function AdminOutreachPage() {
  return (
    <RequireAdminToken>
      <AdminOutreachMain />
    </RequireAdminToken>
  );
}
