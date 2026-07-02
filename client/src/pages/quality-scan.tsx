import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  AlertTriangle, ArrowLeft, ArrowUpDown, BookOpen, CheckCircle,
  ChevronDown, ChevronRight, Eye, Loader2, RefreshCw, Shield,
  Sparkles, Wand2, XCircle, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookScanResult {
  draftId: number;
  title: string;
  genre: string;
  wordCount: number;
  passivePct: number;
  adverbPct: number;
  aiTellCount: number;
  dialoguePct: number;
  score: number;
  issues: string[];
  status: "critical" | "needs-work" | "good" | "excellent";
}

interface ChapterResult {
  num: number;
  title: string;
  wordCount: number;
  passivePct: number;
  adverbPct: number;
  aiTellCount: number;
  dialoguePct: number;
  score: number;
  issues: string[];
  status: "critical" | "needs-work" | "good" | "excellent";
}

interface RepairPreview {
  original: string;
  rewritten: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const adminHeaders = () => ({
  "Content-Type": "application/json",
  "x-admin-token": localStorage.getItem("ebgz_admin_token") || "",
});

function scoreColor(score: number) {
  if (score >= 8) return "text-emerald-400";
  if (score >= 6) return "text-yellow-400";
  if (score >= 4) return "text-orange-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 8) return "bg-emerald-500/15 border-emerald-500/30";
  if (score >= 6) return "bg-yellow-500/15 border-yellow-500/30";
  if (score >= 4) return "bg-orange-500/15 border-orange-500/30";
  return "bg-red-500/15 border-red-500/30";
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full border font-bold text-base ${scoreBg(score)} ${scoreColor(score)}`}
    >
      {score.toFixed(1)}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg = {
    critical: "bg-red-500/20 text-red-300 border-red-500/30",
    "needs-work": "bg-orange-500/20 text-orange-300 border-orange-500/30",
    good: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    excellent: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  }[status] ?? "bg-white/10 text-white/60";
  const label = {
    critical: "Critical",
    "needs-work": "Needs Work",
    good: "Good",
    excellent: "Excellent",
  }[status] ?? status;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>
      {label}
    </span>
  );
}

// ─── Repair Preview Dialog ────────────────────────────────────────────────────

function RepairPreviewDialog({
  open,
  onClose,
  draftId,
  chapterNum,
  chapterTitle,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  draftId: number;
  chapterNum: number;
  chapterTitle: string;
  onApply: () => void;
}) {
  const { toast } = useToast();

  const previewQuery = useQuery<{ chapterTitle: string; previews: RepairPreview[]; message?: string }>({
    queryKey: ["repair-preview", draftId, chapterNum],
    queryFn: async () => {
      const r = await fetch(`/api/admin/repair-preview/${draftId}/${chapterNum}`, {
        method: "POST",
        headers: adminHeaders(),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Preview failed");
      return r.json();
    },
    enabled: open,
    staleTime: Infinity,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/admin/apply-chapter-repair/${draftId}/${chapterNum}`, {
        method: "POST",
        headers: adminHeaders(),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Repair failed");
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "Chapter repaired", description: data.message });
      onApply();
      onClose();
    },
    onError: (e: any) => toast({ title: "Repair failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-[#0f1117] border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-amber-200 flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-violet-400" />
            Repair Preview — {chapterTitle}
          </DialogTitle>
        </DialogHeader>

        {previewQuery.isLoading && (
          <div className="flex flex-col items-center gap-3 py-12 text-white/50">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            <p className="text-sm font-serif">Analysing worst paragraphs and generating rewrites…</p>
          </div>
        )}

        {previewQuery.isError && (
          <p className="text-red-400 text-sm py-6 text-center">{(previewQuery.error as any)?.message}</p>
        )}

        {previewQuery.data && (
          <>
            {previewQuery.data.message && previewQuery.data.previews.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <p className="text-emerald-300 text-sm">{previewQuery.data.message}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-xs text-white/40 font-serif">
                  Showing the {previewQuery.data.previews.length} worst paragraph(s) in this chapter with AI-suggested rewrites.
                  Applying will polish <em>all</em> paragraphs in the chapter using the anti-AI pass.
                </p>
                {previewQuery.data.previews.map((p, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                      <div className="text-xs text-red-400 font-medium mb-2 flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> BEFORE
                      </div>
                      <p className="text-sm text-white/70 font-serif leading-relaxed whitespace-pre-wrap">{p.original}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="text-xs text-emerald-400 font-medium mb-2 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> AFTER
                      </div>
                      <p className="text-sm text-white/85 font-serif leading-relaxed whitespace-pre-wrap">{p.rewritten}</p>
                    </div>
                  </div>
                ))}

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={() => applyMutation.mutate()}
                    disabled={applyMutation.isPending}
                    className="bg-violet-600 hover:bg-violet-500 text-white font-serif"
                  >
                    {applyMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Repairing…</>
                    ) : (
                      <><Wand2 className="h-4 w-4 mr-2" /> Apply Full Chapter Repair</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={onClose} className="border-white/20 text-white/60 hover:text-white font-serif">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Chapter Breakdown Panel ──────────────────────────────────────────────────

function ChapterPanel({ draftId, bookTitle }: { draftId: number; bookTitle: string }) {
  const [previewTarget, setPreviewTarget] = useState<{ chapterNum: number; chapterTitle: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<{ chapters: ChapterResult[]; title: string }>({
    queryKey: ["chapter-quality", draftId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/chapter-quality/${draftId}`, { headers: adminHeaders() });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="flex items-center gap-2 py-6 px-4 text-white/40 text-sm font-serif">
      <Loader2 className="h-4 w-4 animate-spin" /> Scanning chapters…
    </div>
  );
  if (isError) return <p className="text-red-400 text-sm px-4 py-4">Failed to load chapter breakdown.</p>;
  if (!data) return null;

  const weakChapters = data.chapters.filter(c => c.score < 7);

  return (
    <div className="bg-white/3 border-t border-white/8 px-4 pb-4 pt-3">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-amber-400/70" />
        <span className="text-xs text-amber-200/70 font-serif font-medium">
          {data.chapters.length} chapters — {weakChapters.length} need attention
        </span>
      </div>

      <div className="grid gap-2">
        {data.chapters.map(ch => (
          <div
            key={ch.num}
            className={`rounded-lg border px-3 py-2.5 ${ch.score < 4 ? "border-red-500/25 bg-red-500/5" : ch.score < 6 ? "border-orange-500/20 bg-orange-500/5" : ch.score < 8 ? "border-yellow-500/15 bg-yellow-500/5" : "border-white/8 bg-white/3"}`}
          >
            <div className="flex items-center gap-2">
              <ScoreBadge score={ch.score} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-serif text-white/85 truncate">{ch.title}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  <span className="text-xs text-white/40">{ch.wordCount.toLocaleString()} words</span>
                  {ch.passivePct > 3 && <span className="text-xs text-orange-400">passive {ch.passivePct}%</span>}
                  {ch.adverbPct > 1.5 && <span className="text-xs text-yellow-400">adverbs {ch.adverbPct}%</span>}
                  {ch.aiTellCount > 0 && <span className="text-xs text-red-400">AI-tells ×{ch.aiTellCount}</span>}
                  {ch.dialoguePct > 0 && <span className="text-xs text-blue-400">dialogue {ch.dialoguePct}%</span>}
                </div>
                {ch.issues.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ch.issues.map((iss, i) => (
                      <span key={i} className="text-[10px] bg-white/8 text-white/50 px-1.5 py-0.5 rounded">{iss}</span>
                    ))}
                  </div>
                )}
              </div>
              {ch.score < 7 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-violet-300 hover:text-violet-200 hover:bg-violet-500/15 border border-violet-500/20 font-serif flex-shrink-0"
                  onClick={() => setPreviewTarget({ chapterNum: ch.num, chapterTitle: ch.title })}
                >
                  <Eye className="h-3 w-3 mr-1" /> Preview Repair
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {previewTarget && (
        <RepairPreviewDialog
          open
          onClose={() => setPreviewTarget(null)}
          draftId={draftId}
          chapterNum={previewTarget.chapterNum}
          chapterTitle={previewTarget.chapterTitle}
          onApply={() => {
            queryClient.invalidateQueries({ queryKey: ["chapter-quality", draftId] });
          }}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SortKey = "score" | "aiTellCount" | "passivePct" | "adverbPct" | "wordCount";

export default function QualityScan() {
  const [, navigate] = useLocation();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(true);
  const [limit, setLimit] = useState(60);
  const { toast } = useToast();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    results: BookScanResult[];
    total: number;
    scannedAt: string;
  }>({
    queryKey: ["bulk-quality-scan", limit],
    queryFn: async () => {
      const r = await fetch(`/api/admin/bulk-quality-scan?limit=${limit}`, { headers: adminHeaders() });
      if (!r.ok) throw new Error((await r.json()).error || "Scan failed");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const sorted = useMemo(() => {
    if (!data?.results) return [];
    const arr = [...data.results];
    arr.sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      return sortAsc ? va - vb : vb - va;
    });
    return arr;
  }, [data, sortKey, sortAsc]);

  const summary = useMemo(() => {
    if (!data?.results) return null;
    const res = data.results;
    return {
      critical: res.filter(r => r.status === "critical").length,
      needsWork: res.filter(r => r.status === "needs-work").length,
      good: res.filter(r => r.status === "good").length,
      excellent: res.filter(r => r.status === "excellent").length,
      avgScore: res.length ? Math.round(res.reduce((s, r) => s + r.score, 0) / res.length * 10) / 10 : 0,
    };
  }, [data]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(key === "score"); }
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(k)}
      className={`flex items-center gap-1 text-xs font-medium transition-colors ${sortKey === k ? "text-amber-300" : "text-white/40 hover:text-white/70"}`}
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <div className="border-b border-white/8 bg-[#0f1117]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            className="text-white/50 hover:text-white hover:bg-white/5 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Admin
          </Button>
          <div className="flex-1">
            <h1 className="font-serif text-lg text-amber-200 flex items-center gap-2">
              <Shield className="h-5 w-5 text-violet-400" />
              Quality Scan
            </h1>
            <p className="text-xs text-white/40">
              Regex-based prose health check across all published ebooks
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-white/15 text-white/60 hover:text-white font-serif"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Re-scan
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Critical", value: summary.critical, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              { label: "Needs Work", value: summary.needsWork, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
              { label: "Good", value: summary.good, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
              { label: "Excellent", value: summary.excellent, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "Avg Score", value: summary.avgScore, color: scoreColor(summary.avgScore), bg: "bg-white/5 border-white/10" },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border p-3 text-center ${c.bg}`}>
                <div className={`text-2xl font-bold font-serif ${c.color}`}>{c.value}</div>
                <div className="text-xs text-white/40 mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-20 text-white/40">
            <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
            <p className="font-serif text-sm">Scanning published books…</p>
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">Failed to load scan results. Make sure you're logged in as admin.</p>
          </div>
        )}

        {/* Table */}
        {data && sorted.length > 0 && (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {/* Sort bar */}
            <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-white/4 border-b border-white/8">
              <span className="text-xs text-white/40 font-serif">{data.total} books</span>
              <span className="text-white/20 hidden sm:inline">|</span>
              <span className="text-xs text-white/30 hidden sm:inline">Sort by:</span>
              <SortBtn k="score" label="Score" />
              <SortBtn k="aiTellCount" label="AI-Tells" />
              <SortBtn k="passivePct" label="Passive %" />
              <SortBtn k="adverbPct" label="Adverbs %" />
              <SortBtn k="wordCount" label="Word Count" />
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/5">
              {sorted.map(book => {
                const expanded = expandedId === book.draftId;
                return (
                  <div key={book.draftId} className="bg-white/2 hover:bg-white/4 transition-colors">
                    {/* Book row */}
                    <button
                      className="w-full text-left px-4 py-3 flex items-center gap-3"
                      onClick={() => setExpandedId(expanded ? null : book.draftId)}
                      data-testid={`book-row-${book.draftId}`}
                    >
                      <ScoreBadge score={book.score} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif text-sm text-white/90 truncate max-w-xs">{book.title}</span>
                          <StatusPill status={book.status} />
                          {book.genre && (
                            <span className="text-[10px] text-white/30 hidden sm:inline">{book.genre}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          <span className="text-xs text-white/35">{book.wordCount.toLocaleString()} words</span>
                          {book.passivePct > 3 && <span className="text-xs text-orange-400">passive {book.passivePct}%</span>}
                          {book.adverbPct > 1.5 && <span className="text-xs text-yellow-400">adverbs {book.adverbPct}%</span>}
                          {book.aiTellCount > 0 && <span className="text-xs text-red-400">AI-tells ×{book.aiTellCount}</span>}
                          {book.dialoguePct > 0 && <span className="text-xs text-blue-400">dialogue {book.dialoguePct}%</span>}
                        </div>
                        {book.issues.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {book.issues.map((iss, i) => (
                              <span key={i} className="text-[10px] bg-red-500/10 text-red-300/80 px-1.5 py-0.5 rounded border border-red-500/15">{iss}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {book.score < 6 && (
                          <span className="hidden sm:flex items-center gap-1 text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full">
                            <Wand2 className="h-3 w-3" /> Repairable
                          </span>
                        )}
                        {expanded ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                      </div>
                    </button>

                    {/* Expanded chapter panel */}
                    {expanded && <ChapterPanel draftId={book.draftId} bookTitle={book.title || ""} />}
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {limit < 200 && (
              <div className="px-4 py-3 border-t border-white/8 bg-white/2 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLimit(l => Math.min(l + 60, 200))}
                  className="text-white/40 hover:text-white text-xs font-serif"
                >
                  Load more books (showing {limit})
                </Button>
              </div>
            )}
          </div>
        )}

        {data && sorted.length === 0 && !isLoading && (
          <div className="flex flex-col items-center gap-3 py-16 text-white/40">
            <Sparkles className="h-10 w-10 text-emerald-400" />
            <p className="font-serif text-sm">No published books found to scan.</p>
          </div>
        )}

        {/* Legend */}
        <div className="rounded-xl border border-white/8 bg-white/2 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-white/50 font-serif">
          <div><span className="text-red-400 font-bold">1–4 Critical</span> — Multiple issues; anti-AI pass + chapter repair recommended</div>
          <div><span className="text-orange-400 font-bold">5–6 Needs Work</span> — Noticeable AI-tells or passive voice patterns</div>
          <div><span className="text-yellow-400 font-bold">7 Good</span> — Minor issues; optional polish</div>
          <div><span className="text-emerald-400 font-bold">8–10 Excellent</span> — Prose reads naturally; no action needed</div>
        </div>
      </div>
    </div>
  );
}
