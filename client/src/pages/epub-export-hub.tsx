import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, FileDown, CheckCircle, XCircle, AlertCircle,
  BookOpen, Loader2, ExternalLink, Package, Search, Star, Upload
} from "lucide-react";
import { Link } from "wouter";

interface BookReadiness {
  draftId: number;
  bookId: number | null;
  title: string;
  author: string | null;
  genre: string;
  description: string | null;
  hasContent: boolean;
  wordCount: number;
  hasCover: boolean;
  status: string;
  score: number; // 0–6
}

interface ExportStatusData {
  books: BookReadiness[];
  totalReady: number;
  totalNeedWork: number;
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {ok
        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        : <XCircle className="h-3.5 w-3.5 text-red-400/70 shrink-0" />}
      <span className={ok ? "text-foreground/80" : "text-muted-foreground/60"}>{label}</span>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round((score / 6) * 100);
  const color =
    score >= 5 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" :
    score >= 3 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" :
                 "text-red-400 border-red-500/40 bg-red-500/10";
  return (
    <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${color}`}>
      {pct}%
    </span>
  );
}

const DISTRIBUTORS = [
  {
    name: "Draft2Digital",
    url: "https://draft2digital.com",
    desc: "Distributes to 40+ retailers incl. Barnes & Noble, Kobo, Apple Books",
    color: "blue",
  },
  {
    name: "Smashwords",
    url: "https://www.smashwords.com/publish",
    desc: "Large indie ebook distributor — Meatgrinder converts ePub to all formats",
    color: "purple",
  },
  {
    name: "Amazon KDP",
    url: "https://kdp.amazon.com",
    desc: "Largest ebook marketplace — upload your ePub directly",
    color: "amber",
  },
  {
    name: "Kobo Writing Life",
    url: "https://www.kobo.com/writinglife",
    desc: "Direct publishing to Kobo — strong international reach",
    color: "red",
  },
];

export default function EpubExportHub() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "needsWork">("all");
  const [downloading, setDownloading] = useState<number | null>(null);
  const token = localStorage.getItem("ebgz_admin_token") || "";

  const { data, isLoading, isError } = useQuery<ExportStatusData>({
    queryKey: ["epub-export-status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/epub-export-status", {
        headers: { "x-admin-token": token },
      });
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Admin access required</p>
      </div>
    );
  }

  const filtered = (data?.books ?? []).filter(b => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) ||
      (b.author ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true :
      filter === "ready" ? b.score >= 5 :
      b.score < 5;
    return matchSearch && matchFilter;
  });

  async function handleDownload(draftId: number, title: string) {
    setDownloading(draftId);
    try {
      const res = await fetch(`/api/content-studio/download-epub/${draftId}`, {
        headers: { "x-admin-token": token },
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-")}.epub`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  const readyCount = data?.totalReady ?? 0;
  const needsCount = data?.totalNeedWork ?? 0;
  const total = (data?.books ?? []).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Link href="/admin">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Admin</Button>
          </Link>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary flex items-center gap-3">
              <Package className="h-8 w-8" /> Distribution Export Hub
            </h1>
            <p className="text-muted-foreground mt-1 font-serif">
              Check every ebook's distribution readiness and export publication-quality ePub files.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/api/content-studio/download-epubs-zip";
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shrink-0"
            data-testid="button-download-all-epubs"
          >
            <Package className="h-4 w-4" /> Export All Ready EPUBs (ZIP)
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-white/10 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-primary">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Published Ebooks</p>
          </div>
          <div className="bg-card border border-emerald-500/20 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-emerald-400">{readyCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Distribution Ready</p>
          </div>
          <div className="bg-card border border-amber-500/20 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-amber-400">{needsCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Needs Improvement</p>
          </div>
          <div className="bg-card border border-white/10 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-white">
              {total > 0 ? Math.round((readyCount / total) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Overall Readiness</p>
          </div>
        </div>

        {/* Distribution platforms */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Submit To These Platforms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DISTRIBUTORS.map(d => (
              <a
                key={d.name}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-card border border-white/10 hover:border-primary/30 rounded-xl p-4 transition-colors group"
                data-testid={`link-distributor-${d.name.toLowerCase().replace(/\s/g, "-")}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-white group-hover:text-primary transition-colors">{d.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Readiness checklist explained */}
        <div className="bg-card border border-white/10 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" /> What Makes an Ebook Distribution-Ready?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs text-muted-foreground">
            {[
              ["Title", "Non-empty book title"],
              ["Author", "Named author (not generic)"],
              ["Description", "Summary/blurb text"],
              ["Cover", "Cover image embedded"],
              ["Content", "Full text (3,000+ words)"],
              ["Genre", "Subject category set"],
            ].map(([label, desc]) => (
              <div key={label} className="bg-black/20 rounded-lg p-3">
                <p className="font-semibold text-white text-xs mb-1">{label}</p>
                <p className="text-muted-foreground text-[11px] leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters & search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or author…"
              className="w-full bg-card border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              data-testid="input-search-books"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "ready", "needsWork"] as const).map(f => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                data-testid={`button-filter-${f}`}
              >
                {f === "all" ? "All" : f === "ready" ? "✅ Ready" : "⚠️ Needs Work"}
              </Button>
            ))}
          </div>
        </div>

        {/* Book list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <p className="text-center text-red-400 py-12">Failed to load. Make sure you're logged in as admin.</p>
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-12">No ebooks match your filter.</p>
            )}
            {filtered.map(book => (
              <div
                key={book.draftId}
                className="bg-card border border-white/8 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"
                data-testid={`row-book-${book.draftId}`}
              >
                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-white truncate">{book.title}</span>
                    <ScoreBadge score={book.score} />
                    {book.score >= 5 && (
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5">
                        Distribution Ready
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                    <span>{book.author ?? <em className="text-red-400">No author</em>}</span>
                    <span>·</span>
                    <span>{book.genre}</span>
                    {book.wordCount > 0 && (
                      <>
                        <span>·</span>
                        <span className={book.wordCount >= 3000 ? "text-emerald-400" : "text-amber-400"}>
                          {book.wordCount.toLocaleString()} words
                        </span>
                      </>
                    )}
                  </div>
                  {/* Checklist */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-1.5">
                    <Check ok={!!book.title} label="Title" />
                    <Check ok={!!book.author && book.author !== "EbookGamez"} label="Author" />
                    <Check ok={!!book.description && book.description.length > 20} label="Description" />
                    <Check ok={book.hasCover} label="Cover" />
                    <Check ok={book.hasContent && book.wordCount >= 3000} label="Content" />
                    <Check ok={!!book.genre} label="Genre" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  {book.score < 5 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{6 - book.score} item{6 - book.score !== 1 ? "s" : ""} missing</span>
                    </div>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleDownload(book.draftId, book.title)}
                    disabled={downloading === book.draftId || !book.hasContent}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 disabled:opacity-50"
                    data-testid={`button-export-epub-${book.draftId}`}
                    title={!book.hasContent ? "No content to export" : "Export distribution ePub"}
                  >
                    {downloading === book.draftId
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <FileDown className="h-3.5 w-3.5" />}
                    Export ePub
                  </Button>
                  {book.bookId && (
                    <Link href={`/book/${book.bookId}`}>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-white" title="View book page">
                        <BookOpen className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
