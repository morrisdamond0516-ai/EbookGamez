import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, Users, Eye, Monitor, Smartphone, Globe, ArrowLeft, Clock, ShoppingBag, DollarSign, UserCheck, TrendingUp, Route, Timer } from "lucide-react";
import { Link } from "wouter";

interface SessionJourney {
  sessionId: string;
  visitorId: string;
  deviceType: string;
  customerEmail: string | null;
  sessionStart: string;
  pageCount: number;
  totalTime: number | null;
  pages: string[];
}

interface AnalyticsData {
  period: string;
  totalViews: number;
  uniqueVisitors: number;
  avgPagesPerSession: number | null;
  avgSessionSeconds: number | null;
  topPages: { path: string; views: number; uniqueVisitors: number; avgTimeOnPage: number | null }[];
  dailyViews: { date: string; views: number; visitors: number }[];
  deviceBreakdown: { deviceType: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  recentViews: { path: string; visitorId: string; deviceType: string; referrer: string | null; timeOnPage: number | null; createdAt: string }[];
  sessionJourneys: SessionJourney[];
  totalPurchases: number;
  totalRevenue: number;
  uniqueBuyers: number;
  monthlyPurchases: { month: string; count: number; revenue: number }[];
  recentPurchases: { id: number; customerEmail: string; total: string; status: string; createdAt: string }[];
}

function fmtTime(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function pageName(path: string): string {
  if (path === "/" || path === "") return "Home";
  return path.replace(/^\//, "").replace(/-/g, " ").replace(/\//g, " › ");
}

export default function SiteAnalytics() {
  const [days, setDays] = useState(30);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const token = localStorage.getItem("ebgz_admin_token");

  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ["analytics", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics?days=${days}`, {
        headers: { "x-admin-token": token || "" },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  const maxDailyViews = Math.max(...(data?.dailyViews?.map(d => Number(d.views)) || [1]));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="link-back-admin">
                <ArrowLeft className="h-4 w-4 mr-2" /> Admin
              </Button>
            </Link>
            <h1 className="text-3xl font-serif font-bold text-primary flex items-center gap-3">
              <BarChart3 className="h-8 w-8" /> Site Analytics
            </h1>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <Button
                key={d}
                variant={days === d ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(d)}
                data-testid={`button-days-${d}`}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <p className="text-center text-red-400 py-12">Failed to load analytics. Make sure you're logged in as admin.</p>
        ) : data ? (
          <div className="space-y-8">

            {/* ── Overview stats ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Eye className="h-6 w-6" />} label="Total Page Views" value={data.totalViews.toLocaleString()} />
              <StatCard icon={<Users className="h-6 w-6" />} label="Unique Visitors" value={data.uniqueVisitors.toLocaleString()} />
              <StatCard
                icon={<Route className="h-6 w-6" />}
                label="Avg Pages / Session"
                value={data.avgPagesPerSession != null ? data.avgPagesPerSession.toFixed(1) : "—"}
                sub="pages per visit"
              />
              <StatCard
                icon={<Timer className="h-6 w-6" />}
                label="Avg Session Time"
                value={fmtTime(data.avgSessionSeconds ?? null)}
                sub="time per visit"
              />
            </div>

            {/* ── Purchases ── */}
            <div>
              <h2 className="text-xl font-serif font-bold mb-3 flex items-center gap-2 text-primary">
                <ShoppingBag className="h-5 w-5" /> Purchases ({data.period})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<ShoppingBag className="h-6 w-6" />} label="Purchases" value={data.totalPurchases.toLocaleString()} />
                <StatCard icon={<DollarSign className="h-6 w-6" />} label="Revenue" value={`$${Number(data.totalRevenue).toFixed(2)}`} />
                <StatCard icon={<UserCheck className="h-6 w-6" />} label="Unique Buyers" value={data.uniqueBuyers.toLocaleString()} />
                <StatCard
                  icon={<TrendingUp className="h-6 w-6" />}
                  label="Avg Order Value"
                  value={data.totalPurchases > 0 ? `$${(Number(data.totalRevenue) / data.totalPurchases).toFixed(2)}` : "$0.00"}
                />
              </div>
            </div>

            {/* ── Monthly purchases chart ── */}
            {data.monthlyPurchases && data.monthlyPurchases.length > 0 && (
              <div className="bg-card border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Purchases per Month (Last 12 Months)
                </h2>
                {(() => {
                  const maxCount = Math.max(...data.monthlyPurchases.map(m => m.count), 1);
                  return (
                    <div className="flex items-end gap-2 h-48">
                      {data.monthlyPurchases.map((m, i) => {
                        const height = (m.count / maxCount) * 100;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative" data-testid={`bar-month-${m.month}`}>
                            <div className="absolute -top-12 bg-black/90 text-xs text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                              {m.month}<br />{m.count} {m.count === 1 ? "purchase" : "purchases"}<br />${Number(m.revenue).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{m.count}</div>
                            <div
                              className="w-full bg-emerald-500/70 hover:bg-emerald-400 rounded-t transition-colors min-h-[4px]"
                              style={{ height: `${Math.max(height, 2)}%` }}
                            />
                            <span className="text-[10px] text-muted-foreground mt-1">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Recent purchases ── */}
            {data.recentPurchases && data.recentPurchases.length > 0 && (
              <div className="bg-card border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" /> Recent Purchases
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-white/10">
                        <th className="pb-2 pr-4">Time</th>
                        <th className="pb-2 pr-4">Customer</th>
                        <th className="pb-2 pr-4 text-right">Amount</th>
                        <th className="pb-2">Order #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentPurchases.map((p) => (
                        <tr key={p.id} className="border-b border-white/5 last:border-0" data-testid={`row-purchase-${p.id}`}>
                          <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{new Date(p.createdAt).toLocaleString()}</td>
                          <td className="py-2 pr-4 truncate max-w-[220px]">{p.customerEmail}</td>
                          <td className="py-2 pr-4 text-right text-emerald-400 font-medium">${Number(p.total).toFixed(2)}</td>
                          <td className="py-2 text-muted-foreground">#{p.id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Daily traffic chart ── */}
            {data.dailyViews.length > 0 && (
              <div className="bg-card border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Daily Traffic
                </h2>
                <div className="flex items-end gap-1 h-48">
                  {data.dailyViews.map((d, i) => {
                    const height = maxDailyViews > 0 ? (Number(d.views) / maxDailyViews) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute -top-8 bg-black/90 text-xs text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                          {d.date}: {d.views} views, {d.visitors} visitors
                        </div>
                        <div
                          className="w-full bg-primary/70 hover:bg-primary rounded-t transition-colors"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        {data.dailyViews.length <= 14 && (
                          <span className="text-[10px] text-muted-foreground rotate-45 origin-left mt-1">
                            {d.date.slice(5)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Top pages + devices + referrers ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" /> Top Pages
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-white/10 text-xs">
                        <th className="pb-2 pr-3">Page</th>
                        <th className="pb-2 pr-3 text-right">Views</th>
                        <th className="pb-2 pr-3 text-right">Visitors</th>
                        <th className="pb-2 text-right">Avg Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topPages.map((p, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0" data-testid={`text-page-${i}`}>
                          <td className="py-2 pr-3 font-mono text-foreground/80 text-xs max-w-[160px] truncate">{p.path}</td>
                          <td className="py-2 pr-3 text-right text-muted-foreground">{Number(p.views).toLocaleString()}</td>
                          <td className="py-2 pr-3 text-right text-muted-foreground">{Number(p.uniqueVisitors).toLocaleString()}</td>
                          <td className="py-2 text-right">
                            <span className={p.avgTimeOnPage ? "text-primary" : "text-muted-foreground"}>
                              {fmtTime(p.avgTimeOnPage)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.topPages.length === 0 && (
                        <tr><td colSpan={4} className="py-4 text-center text-muted-foreground text-sm">No data yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-card border border-white/10 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-primary" /> Devices
                  </h2>
                  <div className="space-y-3">
                    {data.deviceBreakdown.map((d, i) => {
                      const total = data.deviceBreakdown.reduce((s, x) => s + Number(x.count), 0);
                      const pct = total > 0 ? (Number(d.count) / total * 100).toFixed(1) : "0";
                      return (
                        <div key={i} className="flex items-center gap-3">
                          {d.deviceType === "mobile" ? <Smartphone className="h-4 w-4 text-primary" /> : <Monitor className="h-4 w-4 text-primary" />}
                          <span className="text-sm capitalize flex-1">{d.deviceType || "unknown"}</span>
                          <span className="text-sm text-muted-foreground">{Number(d.count).toLocaleString()} ({pct}%)</span>
                        </div>
                      );
                    })}
                    {data.deviceBreakdown.length === 0 && (
                      <p className="text-muted-foreground text-sm">No device data yet.</p>
                    )}
                  </div>
                </div>

                <div className="bg-card border border-white/10 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" /> Top Referrers
                  </h2>
                  <div className="space-y-2">
                    {data.topReferrers.map((r, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-sm truncate flex-1 mr-4 text-foreground/80">{r.referrer}</span>
                        <span className="text-sm text-muted-foreground shrink-0">{Number(r.count).toLocaleString()}</span>
                      </div>
                    ))}
                    {data.topReferrers.length === 0 && (
                      <p className="text-muted-foreground text-sm">No referrer data yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Session Journeys ── */}
            {data.sessionJourneys && data.sessionJourneys.length > 0 && (
              <div className="bg-card border border-white/10 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                  <Route className="h-5 w-5 text-primary" /> Session Journeys
                </h2>
                <p className="text-xs text-muted-foreground mb-5">Each row is one visitor session. Click to see every page they viewed in order.</p>
                <div className="space-y-2">
                  {data.sessionJourneys.map((s) => {
                    const isOpen = expandedSession === s.sessionId;
                    return (
                      <div key={s.sessionId} className="border border-white/8 rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                          onClick={() => setExpandedSession(isOpen ? null : s.sessionId)}
                        >
                          {/* device icon */}
                          <span className="text-muted-foreground shrink-0">
                            {String(s.deviceType) === "mobile" ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                          </span>
                          {/* visitor id */}
                          <span className="text-xs font-mono text-muted-foreground shrink-0 w-16">{s.visitorId}…</span>
                          {/* customer email if known */}
                          {s.customerEmail && (
                            <span className="text-xs text-primary truncate max-w-[160px]">{String(s.customerEmail)}</span>
                          )}
                          {/* page breadcrumb preview */}
                          <span className="flex-1 text-xs text-foreground/60 truncate">
                            {Array.isArray(s.pages) ? s.pages.slice(0, 4).map(pageName).join(" → ") : ""}
                            {Array.isArray(s.pages) && s.pages.length > 4 ? ` +${s.pages.length - 4} more` : ""}
                          </span>
                          {/* stats */}
                          <span className="shrink-0 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{s.pageCount}p</span>
                            {s.totalTime != null && <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{fmtTime(s.totalTime)}</span>}
                            <span>{new Date(s.sessionStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </span>
                          <span className="text-muted-foreground text-xs ml-1">{isOpen ? "▲" : "▼"}</span>
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-black/20">
                            <p className="text-xs text-muted-foreground mb-3">
                              {new Date(s.sessionStart).toLocaleString()} · {String(s.deviceType)} · {s.pageCount} pages
                              {s.totalTime != null ? ` · ${fmtTime(s.totalTime)} total` : ""}
                              {s.customerEmail ? ` · ${String(s.customerEmail)}` : ""}
                            </p>
                            <ol className="space-y-1.5">
                              {Array.isArray(s.pages) && s.pages.map((page: string, idx: number) => (
                                <li key={idx} className="flex items-center gap-2 text-sm">
                                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{idx + 1}.</span>
                                  <span className="font-mono text-foreground/70 text-xs bg-white/5 px-2 py-0.5 rounded">{page}</span>
                                  <span className="text-xs text-muted-foreground">{pageName(page)}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Recent Visits ── */}
            <div className="bg-card border border-white/10 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Recent Page Visits</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-white/10">
                      <th className="pb-2 pr-4">Time</th>
                      <th className="pb-2 pr-4">Page</th>
                      <th className="pb-2 pr-4">Device</th>
                      <th className="pb-2 pr-4">Time Spent</th>
                      <th className="pb-2">Referrer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentViews.map((v, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap text-xs">
                          {new Date(v.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4 font-mono text-foreground/80 text-xs">{v.path}</td>
                        <td className="py-2 pr-4 capitalize text-xs">{v.deviceType}</td>
                        <td className="py-2 pr-4 text-xs">
                          <span className={v.timeOnPage ? "text-primary font-medium" : "text-muted-foreground"}>
                            {fmtTime(v.timeOnPage)}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground truncate max-w-[180px] text-xs">
                          {v.referrer || "—"}
                        </td>
                      </tr>
                    ))}
                    {data.recentViews.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-muted-foreground">No visits recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <Footer />
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-white/10 rounded-xl p-5 flex items-center gap-4">
      <div className="p-3 bg-primary/10 rounded-lg text-primary shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold leading-tight" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
