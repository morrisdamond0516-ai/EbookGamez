import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  BookOpen,
  Trash2,
  Upload,
  ExternalLink,
  Home,
  Zap,
  Eye,
  EyeOff,
  X,
  Download,
  Pencil,
  Package,
  FileUp,
  FileDown,
  ImageIcon,
  ImageOff,
  RefreshCw,
  Search,
  Scissors,
  ChevronDown,
  AlertTriangle,
  AlignLeft,
  CheckSquare,
  Wand2,
  BarChart2,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RequireAdminToken } from "@/components/require-admin-token";

// Helper to format effect names for display
const formatEffectName = (effect: string) => {
  const effectLabels: Record<string, string> = {
    "elegant-glow": "Elegant Glow",
    "gold-emboss": "Gold Emboss",
    "sharp-shadow": "Sharp Shadow",
    "subtle-outline": "Subtle Outline", 
    "neon-glow": "Neon Glow",
    "bold-shadow": "Bold Shadow",
    "emboss": "Emboss",
    "vintage": "Vintage",
    "outline": "Classic Outline",
    "shadow": "Drop Shadow",
    "glow": "Soft Glow",
    "elegant": "Elegant",
    "neon": "Neon",
    "none": "None (Plain)"
  };
  return effectLabels[effect] || effect.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

// Helper to format position names for display
const formatPositionName = (position: string) => {
  const positionLabels: Record<string, string> = {
    "top-center": "Top Center",
    "center": "Center",
    "bottom-center": "Bottom Center",
    "top-left": "Top Left",
    "top-right": "Top Right",
    "bottom-left": "Bottom Left",
    "bottom-right": "Bottom Right"
  };
  return positionLabels[position] || position;
};

/** Normalize cover paths for local dev (objstore → uploads; server proxies missing files). */
function coverImgSrc(url: string | null | undefined): string {
  if (!url) return "";
  return url.replace(/^\/objstore\/covers\//, "/uploads/covers/");
}

function DraftCoverThumb({
  coverUrl,
  backgroundUrl,
  alt,
  className,
}: {
  coverUrl: string | null | undefined;
  backgroundUrl?: string | null;
  alt: string;
  className?: string;
}) {
  const primary = coverImgSrc(coverUrl);
  const fallback = coverImgSrc(backgroundUrl);
  const [src, setSrc] = useState(primary || fallback);

  useEffect(() => {
    setSrc(primary || fallback);
  }, [primary, fallback]);

  if (!src) {
    return (
      <div className={`bg-white/5 rounded flex items-center justify-center ${className || ""}`}>
        <BookOpen className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (fallback && src !== fallback) setSrc(fallback);
      }}
    />
  );
}

function DraftIdCell({
  draftId,
  queueStar,
}: {
  draftId: number;
  queueStar?: boolean;
}) {
  return (
    <TableCell className="text-muted-foreground font-mono text-sm">
      {queueStar && (
        <span className="text-yellow-400 mr-1" title="Next in queue">★</span>
      )}
      {draftId}
    </TableCell>
  );
}

interface DraftEbook {
  id: number;
  title: string;
  genre: string;
  topic: string;
  status: string;
  coverUrl: string | null;
  backgroundUrl?: string | null;
  suggestedPrice: string | null;
  createdAt: string;
  publishedAt?: string | null;
  outline?: string | null;
  content?: string | null;
  pdfUrl?: string | null;
  contentWordCount?: number;
  hasTBCMarker?: boolean;
  hasIllustrations?: boolean;
  bookVisible?: boolean;
  publishedBookId?: number | null;
  inCatalog?: boolean;
  needsProdPush?: boolean;
  prodSyncReason?: "never_pushed" | "local_changes" | "synced" | "not_published" | null;
  lastProdSyncedAt?: string | null;
  /** Tagged for later fix (e.g. missing illustrations) — still published / considered good. */
  qualityDeferral?: boolean;
  qualityDeferralReason?: string | null;
  qualityDeferralNote?: string | null;
}

interface GenerationJob {
  id: number;
  type: string;
  genre: string;
  status: string;
  totalItems: number;
  completedItems: number;
  error: string | null;
  createdAt: string;
}

import { PROD_PUSH_BATCH_SIZE } from "@shared/prodSyncMetadata";

const VISUAL_FIRST_GENRES = new Set(["Comics", "Graphic Novels", "Photography Books", "Coloring Books", "Art Books"]);
const PUSH_TO_PROD_MAX = PROD_PUSH_BATCH_SIZE;
const DEFAULT_PRODUCTION_URL = "https://ebookgamez.com";
/** Optional Replit app URL when it differs from the custom domain (same push API). */
const DEFAULT_REPLIT_URL = "";
type ProdSyncMode = "selected" | "pending";

function normalizeProdUrl(raw: string): string {
  return raw.trim().replace(/\/$/, "");
}

function isLocalDevUrl(raw: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/i.test(raw.trim());
}

export default function ContentStudio() {
  return (
    <RequireAdminToken>
      <ContentStudioMain />
    </RequireAdminToken>
  );
}

function ContentStudioMain() {
  const [studioSearchQuery, setStudioSearchQuery] = useState("");
  const [publishedExpanded, setPublishedExpanded] = useState(false);
  const [formatScanResults, setFormatScanResults] = useState<any[] | null>(null);
  const [formatScanLoading, setFormatScanLoading] = useState(false);
  const [formatApplyLoading, setFormatApplyLoading] = useState(false);
  const [formatApplyMsg, setFormatApplyMsg] = useState<string | null>(null);
  const [selectedForFormat, setSelectedForFormat] = useState<Set<number>>(new Set());
  const [bookVisibilityOverrides, setBookVisibilityOverrides] = useState<Map<number, boolean>>(new Map());
  const [togglingVisibility, setTogglingVisibility] = useState<Set<number>>(new Set());

  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [customGenre, setCustomGenre] = useState<string>("");
  const [count, setCount] = useState(20);
  const customDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const [reviewDraft, setReviewDraft] = useState<DraftEbook | null>(null);
  const [reviewFullContent, setReviewFullContent] = useState<string | null>(null);
  const [reviewFullOutline, setReviewFullOutline] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<DraftEbook | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [rewriteSectionNum, setRewriteSectionNum] = useState<number>(0);
  const [rewritingSectionId, setRewritingSectionId] = useState<number | null>(null);
  const [sectionList, setSectionList] = useState<{ type: string; number: number; title: string; wordCount: number }[]>([]);
  const [openSectionPicker, setOpenSectionPicker] = useState<number | null>(null);
  const [draftSections, setDraftSections] = useState<Record<number, { type: string; number: number; title: string; wordCount: number }[]>>({});
  const [draftSectionNum, setDraftSectionNum] = useState<Record<number, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"covers" | "pdfs">("covers");
  const [aiProvider, setAiProvider] = useState<"openai" | "replit">("openai");
  const [rewriteConfirmDraft, setRewriteConfirmDraft] = useState<DraftEbook | null>(null);
  const [rewriteGenre, setRewriteGenre] = useState("");
  // Cover Preview state
  const [previewPage, setPreviewPage] = useState(1);
  const [previewOptions, setPreviewOptions] = useState<Record<number, {
    titleFont: string;
    authorFont: string;
    titleCase: "uppercase" | "titlecase" | "original";
    effect: string;
    position: string;
  }>>({});
  const [previewImages, setPreviewImages] = useState<Record<number, string>>({});
  const [loadingPreviews, setLoadingPreviews] = useState<Set<number>>(new Set());
  // Cover style selector state
  const [regeneratingTitle, setRegeneratingTitle] = useState(false);
  const [isStyleSelectorOpen, setIsStyleSelectorOpen] = useState(false);
  const [styleDraftId, setStyleDraftId] = useState<number | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<string>("classic-cinematic");
  const [regeneratingWithStyle, setRegeneratingWithStyle] = useState(false);
  const [syncToProductionOpen, setSyncToProductionOpen] = useState(false);
  const [productionUrl, setProductionUrl] = useState(() => {
    const saved = localStorage.getItem("ebgz_prod_url") || "";
    if (saved && !isLocalDevUrl(saved)) return saved;
    return DEFAULT_PRODUCTION_URL;
  });
  const [replitUrl, setReplitUrl] = useState(() => {
    const saved = localStorage.getItem("ebgz_replit_url") || DEFAULT_REPLIT_URL;
    if (saved && !isLocalDevUrl(saved)) return saved;
    return "";
  });
  const [syncMode, setSyncMode] = useState<ProdSyncMode>("pending");
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSyncProgress, setAutoSyncProgress] = useState<{
    pushed: number;
    remaining: number;
    batch: number;
    target?: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    totalDrafts: number;
    totalUpdated: number;
    totalInserted: number;
    totalErrors: number;
    coversUploaded?: number;
    coversMissing?: number;
    verification?: { title: string; onStorefront: boolean; hasCover: boolean }[];
    warnings?: string[];
    ok?: boolean;
    message: string;
    remainingPending?: number;
  } | null>(null);
  const publishedSectionRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleBookVisibility = async (draft: DraftEbook) => {
    const draftId = draft.id;
    const inCatalog = draft.inCatalog ?? draft.publishedBookId != null;
    if (!inCatalog) {
      setTogglingVisibility(prev => new Set(prev).add(draftId));
      try {
        const res = await fetch(`/api/content-studio/drafts/${draftId}/push-to-storefront`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": localStorage.getItem("ebgz_admin_token") || "",
          },
          body: JSON.stringify({ subscriberExclusive: false }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast({ title: "Publish to Storefront failed", description: data.error || "Failed", variant: "destructive" });
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/books"] });
        toast({
          title: "On the storefront",
          description: `Catalog book #${data.bookId} created — draft #${draftId} stays Published in AI Studio.`,
        });
      } catch {
        toast({ title: "Error", description: "Network error", variant: "destructive" });
      } finally {
        setTogglingVisibility(prev => { const next = new Set(prev); next.delete(draftId); return next; });
      }
      return;
    }
    setTogglingVisibility(prev => new Set(prev).add(draftId));
    try {
      const res = await fetch(`/api/admin/drafts/${draftId}/toggle-book-visibility`, {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Not in Catalog", description: data.error || "Failed to toggle visibility", variant: "destructive" });
        return;
      }
      const { visible } = await res.json();
      setBookVisibilityOverrides(prev => new Map(prev).set(draftId, visible));
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      toast({
        title: visible ? "Book Republished" : "Book Unpublished",
        description: visible ? "Book is now visible on the storefront." : "Book hidden from storefront. Use Republish to restore it.",
      });
    } catch {
      toast({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setTogglingVisibility(prev => { const next = new Set(prev); next.delete(draftId); return next; });
    }
  };

  useEffect(() => {
    async function verifyAndRefreshSession() {
      const token = localStorage.getItem("ebgz_admin_token") || "";
      await fetch("/api/admin/verify", {
        headers: { "x-admin-token": token },
      });
    }
    verifyAndRefreshSession();
  }, []);

  useEffect(() => {
    const adminToken = localStorage.getItem("ebgz_admin_token") || "";
    fetch("/api/content-studio/ai-provider", {
      headers: { "x-admin-token": adminToken }
    }).then(r => r.json()).then(d => {
      if (d.provider) setAiProvider(d.provider);
    }).catch(() => {});
  }, []);

  const toggleAIProvider = async () => {
    const newProvider = aiProvider === "openai" ? "replit" : "openai";
    const adminToken = localStorage.getItem("ebgz_admin_token") || "";
    try {
      const res = await fetch("/api/content-studio/ai-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ provider: newProvider }),
      });
      if (res.ok) {
        setAiProvider(newProvider);
        toast({
          title: "AI Provider Changed",
          description: `Content generation now using ${newProvider === "replit" ? "Replit AI" : "OpenAI"}`,
        });
      }
    } catch {}
  };

  // Open style selector for a specific draft
  const openStyleSelector = (draftId: number) => {
    setStyleDraftId(draftId);
    setSelectedStyleId("classic-cinematic");
    setIsStyleSelectorOpen(true);
  };

  // Regenerate cover with selected style
  const regenerateCoverWithStyle = async () => {
    if (!styleDraftId) return;
    setRegeneratingWithStyle(true);
    try {
      const res = await fetch(`/api/content-studio/regenerate-cover-with-style/${styleDraftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: selectedStyleId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to regenerate cover");
      }
      const data = await res.json();
      toast({ title: "Success", description: data.message || "Cover regenerated with new style" });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts-with-backgrounds"] });
      setIsStyleSelectorOpen(false);
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to regenerate cover with style", 
        variant: "destructive" 
      });
    } finally {
      setRegeneratingWithStyle(false);
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDownloadCover = (draftId: number) => {
    window.location.href = `/api/content-studio/download-cover/${draftId}`;
  };

  const openEditDialog = (draft: DraftEbook) => {
    setEditingDraft(draft);
    setEditTitle(draft.title);
    setEditPrice(draft.suggestedPrice || "");
    setEditGenre(draft.genre || "");
    setRewriteSectionNum(0);
    setRewritingSectionId(null);
    setIsEditOpen(true);
    if ((draft.contentWordCount || 0) > 50) {
      fetch(`/api/content-studio/drafts/${draft.id}/sections`, {
          headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" }
        })
        .then(r => r.json())
        .then(data => {
          const sections = data.sections || [];
          setSectionList(sections);
          if (sections.length > 0) setRewriteSectionNum(sections[0].number);
        })
        .catch(() => setSectionList([]));
    } else {
      setSectionList([]);
    }
  };

  const loadSectionsForDraft = async (draftId: number) => {
    const adminToken = localStorage.getItem("ebgz_admin_token") || "";
    try {
      const res = await fetch(`/api/content-studio/drafts/${draftId}/sections`, {
        headers: { "x-admin-token": adminToken }
      });
      const data = await res.json();
      const sections = data.sections || [];
      setDraftSections(prev => ({ ...prev, [draftId]: sections }));
      if (sections.length > 0 && !draftSectionNum[draftId]) {
        setDraftSectionNum(prev => ({ ...prev, [draftId]: sections[0].number }));
      }
    } catch {
      setDraftSections(prev => ({ ...prev, [draftId]: [] }));
    }
  };

  const triggerSectionRewrite = async (draftId: number, sectionNumber: number) => {
    const adminToken = localStorage.getItem("ebgz_admin_token") || "";
    setRewritingSectionId(draftId);
    try {
      const res = await fetch(`/api/content-studio/rewrite-section/${draftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ sectionNumber }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast({ title: "Section Rewrite Started", description: `${sectionNumber === 0 ? "About this Book" : `Chapter ${sectionNumber}`} is being rewritten.` });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start rewrite", variant: "destructive" });
    } finally {
      setRewritingSectionId(null);
      setOpenSectionPicker(null);
    }
  };

  const { data: genres = [] } = useQuery<string[]>({
    queryKey: ["/api/content-studio/genres"],
  });

  const { data: activeDrafts = [], isLoading: activeDraftsLoading } = useQuery<DraftEbook[]>({
    queryKey: ["/api/content-studio/drafts", "active"],
    queryFn: () => fetch("/api/content-studio/drafts?status=active", {
      headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
    }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: publishedDraftsData = [], isLoading: publishedDraftsLoading } = useQuery<DraftEbook[]>({
    queryKey: ["/api/content-studio/drafts", "published"],
    queryFn: () => fetch("/api/content-studio/drafts?status=published", {
      headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
    }).then(r => r.json()),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const drafts = useMemo(() => [...(Array.isArray(activeDrafts) ? activeDrafts : []), ...(Array.isArray(publishedDraftsData) ? publishedDraftsData : [])], [activeDrafts, publishedDraftsData]);
  const draftsLoading = activeDraftsLoading || publishedDraftsLoading;

  const filteredDrafts = useMemo(() => {
    if (!studioSearchQuery.trim()) return drafts;
    const q = studioSearchQuery.toLowerCase();
    return drafts.filter(d => d.title.toLowerCase().includes(q) || d.genre?.toLowerCase().includes(q) || String(d.id) === q.trim());
  }, [drafts, studioSearchQuery]);

  const unpublishedDrafts = useMemo(() => filteredDrafts.filter(d => d.status !== "published"), [filteredDrafts]);
  const publishedDrafts = useMemo(() => filteredDrafts.filter(d => d.status === "published"), [filteredDrafts]);

  const pushToProdCounts = useMemo(() => {
    const published = drafts.filter(d => d.status === "published" && (d.content === "has_content" || (d.content && d.content.length > 100)));
    const selected = published.filter(d => selectedIds.has(d.id));
    const pendingDrafts = published
      .filter(d => d.needsProdPush)
      .sort((a, b) => {
        const aNew = a.prodSyncReason === "never_pushed" ? 0 : 1;
        const bNew = b.prodSyncReason === "never_pushed" ? 0 : 1;
        if (aNew !== bNew) return aNew - bNew;
        return a.title.localeCompare(b.title);
      });
    const neverPushed = pendingDrafts.filter(d => d.prodSyncReason === "never_pushed").length;
    const localChanges = pendingDrafts.filter(d => d.prodSyncReason === "local_changes").length;
    return {
      selected: selected.length,
      pending: pendingDrafts.length,
      neverPushed,
      localChanges,
      pendingDrafts,
    };
  }, [drafts, selectedIds]);

  const pushCountForMode = useMemo(() => {
    if (syncMode === "selected") return pushToProdCounts.selected;
    return Math.min(pushToProdCounts.pending, PUSH_TO_PROD_MAX);
  }, [syncMode, pushToProdCounts]);

  const isOverPushLimit = useMemo(() => {
    if (syncMode === "pending") return false;
    return selectedIds.size > PUSH_TO_PROD_MAX;
  }, [syncMode, selectedIds.size]);

  const pushTargets = useMemo(() => {
    const live = normalizeProdUrl(productionUrl);
    const replit = normalizeProdUrl(replitUrl);
    const targets: { label: string; url: string }[] = [];
    if (live && !isLocalDevUrl(live)) targets.push({ label: "Live site", url: live });
    if (replit && !isLocalDevUrl(replit) && replit !== live) {
      targets.push({ label: "Replit", url: replit });
    }
    return targets;
  }, [productionUrl, replitUrl]);

  const pushDisabledReason = useMemo(() => {
    if (isSyncing) return "Sync in progress…";
    if (pushTargets.length === 0) {
      return "Enter https://ebookgamez.com (and optional Replit URL) — not localhost.";
    }
    if (isOverPushLimit) return `Too many books (max ${PUSH_TO_PROD_MAX}).`;
    if (syncMode === "selected") {
      if (selectedIds.size === 0) return "Check one or more rows in Published Books below.";
      if (pushToProdCounts.selected === 0) {
        return `You checked ${selectedIds.size} row(s), but none are published with content.`;
      }
    } else if (pushToProdCounts.pending === 0) {
      return "All published books are synced to production.";
    }
    return null;
  }, [
    isSyncing, pushTargets.length, isOverPushLimit, syncMode, selectedIds.size,
    pushToProdCounts.selected, pushToProdCounts.pending,
  ]);

  const pushReady = pushDisabledReason === null;

  async function pushOneBatchToUrl(url: string, mode: ProdSyncMode, draftIds?: number[]) {
    const token = localStorage.getItem("ebgz_admin_token") || "";
    const resp = await fetch("/api/admin/push-to-production", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({
        productionUrl: url,
        mode,
        draftIds: mode === "selected" ? draftIds : undefined,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || `Sync failed for ${url}`);
    return data as NonNullable<typeof syncResult>;
  }

  /** Auto-push pending books in batches of 20 to one target URL until the queue is empty or a batch fails storefront checks. */
  async function autoPushPendingToUrl(url: string, label: string) {
    let totalPushed = 0;
    let batches = 0;
    let remaining = pushToProdCounts.pending;
    let lastData: NonNullable<typeof syncResult> | null = null;
    const MAX_AUTO_BATCHES = 200;
    while (batches < MAX_AUTO_BATCHES) {
      setAutoSyncProgress({
        pushed: totalPushed,
        remaining,
        batch: batches + 1,
        target: label,
      });
      const data = await pushOneBatchToUrl(url, "pending");
      lastData = data;
      batches++;
      const batchCount = data.totalDrafts ?? 0;
      totalPushed += batchCount;
      remaining = data.remainingPending ?? Math.max(0, remaining - batchCount);
      if ((data.totalErrors ?? 0) > 0) {
        throw new Error(`${label}: batch ${batches} had ${data.totalErrors} sync error(s). Stopped so you can fix those first.`);
      }
      const missingStorefront = (data.verification ?? []).filter(v => !v.onStorefront);
      if (missingStorefront.length > 0) {
        // Don't keep re-pushing the same failing titles in a loop — surface them and stop.
        break;
      }
      if (batchCount === 0 || remaining === 0) break;
    }
    return { totalPushed, batches, lastData, label, url };
  }

  function summarizePushVerification(data: NonNullable<typeof syncResult> | null | undefined) {
    const verification = data?.verification ?? [];
    const onStorefront = verification.filter(v => v.onStorefront);
    const missing = verification.filter(v => !v.onStorefront);
    const remainingPending = data?.remainingPending ?? 0;
    const trulyDone = missing.length === 0 && remainingPending === 0 && (data?.totalErrors ?? 0) === 0;
    return { verification, onStorefront, missing, remainingPending, trulyDone };
  }

  useEffect(() => {
    if (studioSearchQuery.trim() && publishedDrafts.length > 0) {
      setPublishedExpanded(true);
      setTimeout(() => {
        publishedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [studioSearchQuery, publishedDrafts.length]);

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<GenerationJob[]>({
    queryKey: ["/api/content-studio/jobs"],
    refetchInterval: 10000,
  });

  const { data: illustrationExemptIds = [] } = useQuery<number[]>({
    queryKey: ["/api/content-studio/illustration-exempt-ids"],
    staleTime: 60 * 60 * 1000,
  });
  const exemptSet = useMemo(() => new Set(illustrationExemptIds), [illustrationExemptIds]);

  // Font options for cover preview
  interface FontOptions {
    titleFonts: string[];
    authorFonts: string[];
    effects: string[];
    positions: string[];
    titleCases: string[];
  }
  const { data: fontOptions } = useQuery<FontOptions>({
    queryKey: ["/api/content-studio/font-options"],
  });

  // Cover style presets
  interface CoverStylePreset {
    id: string;
    name: string;
    description: string;
    isPrimary: boolean;
    previewImage?: string;
    colorSchemes: string[];
    designStyles: string[];
    compositionStyles: string[];
    titleFont: string;
    authorFont: string;
    titleCase: "uppercase" | "titlecase" | "original";
    effect: string;
    position: string;
  }
  interface CoverStylesResponse {
    styles: CoverStylePreset[];
    primaryStyleId: string;
  }
  const { data: coverStyles } = useQuery<CoverStylesResponse>({
    queryKey: ["/api/content-studio/cover-styles"],
  });

  // Drafts with backgrounds for preview
  interface DraftsWithBgResponse {
    drafts: DraftEbook[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }
  const { data: draftsWithBg, isLoading: draftsWithBgLoading } = useQuery<DraftsWithBgResponse>({
    queryKey: ["/api/content-studio/drafts-with-backgrounds", previewPage],
    queryFn: async () => {
      const res = await fetch(`/api/content-studio/drafts-with-backgrounds?page=${previewPage}&limit=12`, {
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
  });

  // Generate preview for a draft
  const generatePreview = async (draftId: number, options: typeof previewOptions[number]) => {
    setLoadingPreviews(prev => new Set(prev).add(draftId));
    try {
      const res = await fetch("/api/content-studio/preview-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: JSON.stringify({ draftId, options }),
      });
      if (!res.ok) throw new Error("Failed to generate preview");
      const data = await res.json();
      setPreviewImages(prev => ({ ...prev, [draftId]: data.preview }));
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" });
    } finally {
      setLoadingPreviews(prev => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    }
  };

  // Finalize cover with selected options
  const finalizeCover = async (draftId: number, options: typeof previewOptions[number]) => {
    try {
      const res = await fetch("/api/content-studio/finalize-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: JSON.stringify({ draftId, options }),
      });
      if (!res.ok) throw new Error("Failed to finalize cover");
      toast({ title: "Success", description: "Cover finalized successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts-with-backgrounds"] });
    } catch (error) {
      toast({ title: "Error", description: "Failed to finalize cover", variant: "destructive" });
    }
  };

  // Initialize options for a draft
  const initOptions = (draftId: number) => {
    if (!previewOptions[draftId] && fontOptions) {
      setPreviewOptions(prev => ({
        ...prev,
        [draftId]: {
          titleFont: fontOptions.titleFonts[0] || "Great Vibes",
          authorFont: fontOptions.authorFonts[0] || "Playfair Display",
          titleCase: "titlecase",
          effect: "outline",
          position: "top-center",
        }
      }));
    }
  };

  // Update option for a draft
  const updateOption = (draftId: number, key: string, value: string) => {
    setPreviewOptions(prev => ({
      ...prev,
      [draftId]: {
        ...prev[draftId],
        [key]: value,
      }
    }));
    // Clear preview image when options change
    setPreviewImages(prev => {
      const next = { ...prev };
      delete next[draftId];
      return next;
    });
  };

  // Select any draft except those still generating (covers not required — needed for EPUB download).
  const bulkSelectableDrafts = useMemo(
    () => drafts.filter(d => d.status !== "generating"),
    [drafts],
  );

  const isDraftSelectable = (draft: DraftEbook) => draft.status !== "generating";

  const selectAll = () => {
    if (selectedIds.size === bulkSelectableDrafts.length && bulkSelectableDrafts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bulkSelectableDrafts.map(d => d.id)));
    }
  };

  const publishedSelectable = useMemo(
    () => publishedDrafts.filter(isDraftSelectable),
    [publishedDrafts],
  );

  const allPublishedSelected =
    publishedSelectable.length > 0 && publishedSelectable.every(d => selectedIds.has(d.id));

  const toggleSelectAllPublished = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPublishedSelected) {
        publishedSelectable.forEach(d => next.delete(d.id));
      } else {
        publishedSelectable.forEach(d => next.add(d.id));
      }
      return next;
    });
  };

  const selectedWithCovers = Array.from(selectedIds).filter(id => {
    const draft = drafts.find(d => d.id === id);
    return draft?.coverUrl || draft?.backgroundUrl;
  });

  const selectedWithPdfs = Array.from(selectedIds).filter(id => 
    drafts.find(d => d.id === id)?.pdfUrl
  );

  const downloadTitlesList = () => {
    const titlesList = drafts.map(d => `${d.id}\t${d.title}\t${d.genre}\t${d.status}\t${d.suggestedPrice || "N/A"}`).join("\n");
    const header = "ID\tTitle\tGenre\tStatus\tPrice\n";
    const blob = new Blob([header + titlesList], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ebook-titles-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCoversWithTitles = () => {
    const list = drafts
      .filter(d => d.coverUrl)
      .map(d => `ID: ${d.id}\nTitle: ${d.title}\nGenre: ${d.genre}\nCover URL: ${d.coverUrl}\n${"─".repeat(50)}`)
      .join("\n\n");
    const blob = new Blob([`Ebook Covers with Titles\nGenerated: ${new Date().toLocaleString()}\n${"═".repeat(50)}\n\n${list}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ebook-covers-titles-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCoversWithContent = () => {
    const list = drafts
      .filter(d => d.coverUrl)
      .map(d => {
        return `ID: ${d.id}\nTitle: ${d.title}\nGenre: ${d.genre}\nCover URL: ${d.coverUrl}\nPrice: ${d.suggestedPrice || "N/A"}\nWords: ${(d.contentWordCount || 0).toLocaleString()}\n\n${"═".repeat(60)}`;
      })
      .join("\n\n");
    const blob = new Blob([`Ebook Covers with Titles and Content\nGenerated: ${new Date().toLocaleString()}\n${"═".repeat(60)}\n\n${list}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ebook-covers-content-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateMutation = useMutation({
    mutationFn: async ({ genre, count }: { genre: string; count: number }) => {
      const response = await fetch("/api/content-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: JSON.stringify({ genre, count }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error("Failed to start generation");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/jobs"] });
      toast({ 
        title: data.visualEnhanced ? "Visual-Enhanced Generation Started" : "Generation Started", 
        description: data.visualEnhanced 
          ? "AI is creating your ebooks with embedded illustrations!" 
          : "AI is now creating your ebooks!" 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start generation", variant: "destructive" });
    },
  });

  const generateAllMutation = useMutation({
    mutationFn: async (countPerGenre: number) => {
      const response = await fetch("/api/content-studio/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: JSON.stringify({ countPerGenre }),
      });
      if (!response.ok) throw new Error("Failed to start bulk generation");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/jobs"] });
      toast({ title: "Bulk Generation Started", description: "Creating ebooks for all genres!" });
    },
  });

  const customBookMutation = useMutation({
    mutationFn: async ({ description, genre }: { description: string; genre?: string }) => {
      const response = await fetch("/api/content-studio/custom-create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: JSON.stringify({ description, genre: genre || undefined }),
      });
      if (!response.ok) throw new Error("Failed to create custom book");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      if (customDescriptionRef.current) customDescriptionRef.current.value = "";
      toast({ title: "Draft Created", description: "Your book idea has been added to drafts. Head to Cover Review to create a cover, then generate content." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create custom book", variant: "destructive" });
    },
  });

  const [autoExclusive, setAutoExclusive] = useState(false);

  const publishMutation = useMutation({
    mutationFn: async (draftId: number) => {
      const response = await fetch(`/api/content-studio/publish/${draftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: JSON.stringify({ subscriberExclusive: autoExclusive }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to publish" }));
        throw new Error(err.error || "Failed to publish");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      const exclusiveMsg = data.subscriberExclusive ? " (30-day subscriber exclusive)" : "";
      toast({ title: "Published!", description: `Ebook is now live in your store${exclusiveMsg}` });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      toast({ title: "Publish Failed", description: error.message, variant: "destructive" });
    },
  });

  const completeContentMutation = useMutation({
    mutationFn: async (draftId: number) => {
      const response = await fetch(`/api/content-studio/complete-content/${draftId}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to complete content");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      toast({ title: "Generating...", description: "AI is writing engaging content for this ebook" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate content", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (draftId: number) => {
      const response = await fetch(`/api/content-studio/drafts/${draftId}`, {
        method: "DELETE",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      if (!response.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      toast({ title: "Deleted", description: "Draft has been removed" });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: async ({ draftId, title, price, genre }: { draftId: number; title: string; price: string; genre?: string }) => {
      const response = await fetch(`/api/content-studio/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: JSON.stringify({ title, suggestedPrice: price, ...(genre ? { genre } : {}) }),
      });
      if (!response.ok) throw new Error("Failed to update");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      setIsEditOpen(false);
      toast({ title: "Updated", description: "Ebook details have been saved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update ebook", variant: "destructive" });
    },
  });

  const [publishDetails, setPublishDetails] = useState<Array<{ id: number; title: string; action: string; issues?: string[] }> | null>(null);
  const [showPublishDetails, setShowPublishDetails] = useState(false);

  const publishAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/content-studio/publish-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: JSON.stringify({ subscriberExclusive: autoExclusive }),
      });
      if (!response.ok) throw new Error("Failed to publish all");
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      const failMsg = data.failedCount > 0 ? ` ${data.failedCount} failed quality gate.` : "";
      toast({ title: "Publish Complete", description: `${data.publishedCount} published.${failMsg}` });
      if (data.details && data.details.length > 0) {
        setPublishDetails(data.details);
        if (data.failedCount > 0) setShowPublishDetails(true);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to publish all drafts", variant: "destructive" });
    },
  });

  const auditPublishedMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/content-studio/audit-published", {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      if (!response.ok) throw new Error("Failed to audit published books");
      return response.json();
    },
    onSuccess: (data: any) => {
      const issueMsg = data.issues > 0 ? `${data.issues} have quality issues.` : "All books passed!";
      toast({ title: "Audit Complete", description: `Scanned ${data.total} published books. ${data.passed} clean. ${issueMsg}` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to audit published books", variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/content-studio/drafts-all", {
        method: "DELETE",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      if (!response.ok) throw new Error("Failed to delete all");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      toast({ title: "Deleted All", description: `${data.deletedCount} drafts have been removed` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete all drafts", variant: "destructive" });
    },
  });

  const [contentGenRunning, setContentGenRunning] = useState(false);
  const [contentGenProgress, setContentGenProgress] = useState<{ total: number; completed: number; current: string; currentId: number | null; nextTitle: string; nextId: number | null; running: boolean; failed: string[] }>({ total: 0, completed: 0, current: "", currentId: null, nextTitle: "", nextId: null, running: false, failed: [] });
  const [illustrationNeeds, setIllustrationNeeds] = useState<{ id: number; title: string; genre: string; status: string; reason: string; actionType: "illustrations-only" | "rewrite-and-illustrate" }[]>([]);
  const [selectedForRewrite, setSelectedForRewrite] = useState<Set<number>>(new Set());
  const [illustrationGenRunning, setIllustrationGenRunning] = useState(false);
  const [illustrationLiveProgress, setIllustrationLiveProgress] = useState<{
    running: boolean; bookId: number | null; bookTitle: string;
    totalBooks: number; completedBooks: number; currentImage: number; totalImages: number;
  }>({ running: false, bookId: null, bookTitle: "", totalBooks: 0, completedBooks: 0, currentImage: 0, totalImages: 0 });

  const generateMissingContentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/content-studio/generate-missing-content", {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start");
      }
      return response.json();
    },
    onSuccess: () => {
      setContentGenRunning(true);
      toast({ title: "Content Generation Started", description: "Writing stories and content for all ebooks missing content" });
      pollContentGenStatus();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start content generation", variant: "destructive" });
    },
  });

  const rewriteIncompleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/content-studio/rewrite-incomplete-content", {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start");
      }
      return response.json();
    },
    onSuccess: () => {
      setContentGenRunning(true);
      toast({ title: "Rewriting Incomplete Books", description: "Regenerating all incomplete ebooks with full chapter-by-chapter content" });
      pollContentGenStatus();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start rewrite", variant: "destructive" });
    },
  });

  const generateSelectedContentMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const response = await fetch("/api/content-studio/generate-selected-content", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start");
      }
      return response.json();
    },
    onSuccess: (_data, ids) => {
      setContentGenRunning(true);
      toast({ title: "Writing Selected", description: `Writing content for ${ids.length} selected ebook(s)` });
      pollContentGenStatus();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start content generation", variant: "destructive" });
    },
  });

  const [rewritingDraftIds, setRewritingDraftIds] = useState<Set<number>>(new Set());
  const [antiAiPassIds, setAntiAiPassIds] = useState<Set<number>>(new Set());
  const [metricsModal, setMetricsModal] = useState<{ draftId: number; title: string } | null>(null);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const openRewriteConfirm = (draft: DraftEbook) => {
    setRewriteConfirmDraft(draft);
    setRewriteGenre(draft.genre || "");
  };

  const startRewrite = async (draftId: number, genreOverride?: string) => {
    setRewriteConfirmDraft(null);
    const adminToken = localStorage.getItem("ebgz_admin_token") || "";
    if (genreOverride) {
      try {
        await fetch(`/api/content-studio/drafts/${draftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
          body: JSON.stringify({ genre: genreOverride }),
        });
      } catch {}
    }
    setRewritingDraftIds(prev => new Set(prev).add(draftId));
    try {
      const response = await fetch(`/api/content-studio/generate-content/${draftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ rewrite: true }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate content");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      toast({ title: "Content Generated", description: "Story/content has been fully rewritten for this ebook" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to generate content", variant: "destructive" });
    }
    setRewritingDraftIds(prev => { const next = new Set(prev); next.delete(draftId); return next; });
  };

  const resetAndRestart = async (draftId: number) => {
    const adminToken = localStorage.getItem("ebgz_admin_token") || "";
    try {
      const resetRes = await fetch(`/api/content-studio/reset-stuck/${draftId}`, {
        method: "POST",
        headers: { "x-admin-token": adminToken },
      });
      if (!resetRes.ok) {
        const err = await resetRes.json();
        throw new Error(err.error || "Failed to reset");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      toast({ title: "Reset Complete", description: "Book reset from generating. You can now Continue Writing or Rewrite." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reset", variant: "destructive" });
    }
  };

  const [continuingDraftIds, setContinuingDraftIds] = useState<Set<number>>(new Set());
  const [illustratingDraftIds, setIllustratingDraftIds] = useState<Set<number>>(new Set());

  const generateIllustrations = async (draftId: number) => {
    setIllustratingDraftIds(prev => new Set(prev).add(draftId));
    try {
      const res = await apiRequest("POST", "/api/content-studio/illustrations-only", { draftIds: [draftId] });
      const data = await res.json();
      toast({ title: "Illustrations Started", description: data.message || "Generating illustrations in the background." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to start illustration generation", variant: "destructive" });
    } finally {
      setTimeout(() => {
        setIllustratingDraftIds(prev => { const s = new Set(prev); s.delete(draftId); return s; });
      }, 5000);
    }
  };

  const writingPollIntervals = useRef<Map<number, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    return () => {
      writingPollIntervals.current.forEach(interval => clearInterval(interval));
      writingPollIntervals.current.clear();
    };
  }, []);

  const continueWriting = async (draftId: number) => {
    setContinuingDraftIds(prev => new Set(prev).add(draftId));
    const adminToken = localStorage.getItem("ebgz_admin_token") || "";
    try {
      const response = await fetch(`/api/content-studio/continue-writing/${draftId}`, {
        method: "POST",
        headers: { "x-admin-token": adminToken },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to continue writing");
      }
      toast({ title: "Writing Started", description: "Continue writing is running in the background. The status will update when done." });
      let attempts = 0;
      const maxAttempts = 120;
      const pollInterval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(pollInterval);
          writingPollIntervals.current.delete(draftId);
          setContinuingDraftIds(prev => { const next = new Set(prev); next.delete(draftId); return next; });
          queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
          return;
        }
        try {
          const statusRes = await fetch(`/api/content-studio/drafts/${draftId}`, {
            headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
          });
          if (statusRes.ok) {
            const draft = await statusRes.json();
            if (draft.status !== "generating") {
              clearInterval(pollInterval);
              writingPollIntervals.current.delete(draftId);
              setContinuingDraftIds(prev => { const next = new Set(prev); next.delete(draftId); return next; });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
              if (draft.status === "ready" || draft.status === "draft") {
                toast({ title: "Writing Complete", description: `"${draft.title}" chapters have been written` });
              } else if (draft.status === "failed") {
                toast({ title: "Writing Failed", description: `"${draft.title}" generation failed`, variant: "destructive" });
              }
            }
          }
        } catch {}
      }, 8000);
      writingPollIntervals.current.set(draftId, pollInterval);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to continue writing", variant: "destructive" });
      setContinuingDraftIds(prev => { const next = new Set(prev); next.delete(draftId); return next; });
    }
  };

  const pollContentGenStatus = () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/content-studio/content-gen-status", {
          headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        });
        const data = await res.json();
        setContentGenProgress(data);
        if (!data.running) {
          clearInterval(interval);
          setContentGenRunning(false);
          setIllustrationGenRunning(false);
          queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
          fetchIllustrationNeeds();
          toast({ title: "Content Generation Complete", description: `Generated content for ${data.completed - data.failed.length} ebooks` });
        }
      } catch {
        clearInterval(interval);
        setContentGenRunning(false);
      }
    }, 5000);
  };

  const stopContentGen = async () => {
    try {
      await fetch("/api/content-studio/stop-content-gen", {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      setContentGenRunning(false);
      toast({ title: "Writing stopped", description: "Prose / dialogue generation was told to stop." });
    } catch {
      toast({ title: "Error", description: "Failed to stop writing", variant: "destructive" });
    }
  };

  const stopIllustrationGen = async () => {
    try {
      const resp = await fetch("/api/content-studio/stop-illustrations", {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      // Older servers may only have stop-content-gen — fall back.
      if (!resp.ok) {
        await fetch("/api/content-studio/stop-content-gen", {
          method: "POST",
          headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        });
      }
      setIllustrationGenRunning(false);
      setIllustrationLiveProgress((prev) => ({ ...prev, running: false }));
      toast({ title: "Art stopped", description: "Illustration generation was told to stop. If it keeps going, stop the Replit process." });
    } catch {
      toast({ title: "Error", description: "Failed to stop illustrations — stop the Replit app to halt spend", variant: "destructive" });
    }
  };

  const stopAllGen = async () => {
    try {
      const resp = await fetch("/api/content-studio/stop-all-gen", {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      if (!resp.ok) {
        await stopContentGen();
        await stopIllustrationGen();
        return;
      }
      setContentGenRunning(false);
      setIllustrationGenRunning(false);
      setIllustrationLiveProgress((prev) => ({ ...prev, running: false }));
      toast({ title: "Everything stopped", description: "Writing/dialogue and illustrations were told to stop." });
    } catch {
      toast({ title: "Error", description: "Failed to stop all jobs", variant: "destructive" });
    }
  };

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importableBooks, setImportableBooks] = useState<any[]>([]);
  const [importingBookId, setImportingBookId] = useState<number | null>(null);

  const fetchImportableBooks = async () => {
    try {
      const res = await fetch("/api/content-studio/importable-books", {
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      const data = await res.json();
      setImportableBooks(data);
      setShowImportDialog(true);
    } catch {
      toast({ title: "Error", description: "Failed to fetch catalog books", variant: "destructive" });
    }
  };

  const importBook = async (bookId: number) => {
    setImportingBookId(bookId);
    try {
      const res = await fetch(`/api/content-studio/import-book/${bookId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Imported", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      setImportableBooks(prev => prev.filter(b => b.id !== bookId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to import", variant: "destructive" });
    }
    setImportingBookId(null);
  };

  const draftsWithoutContent = drafts.filter(d => !d.contentWordCount || d.contentWordCount === 0);
  const draftsIncomplete = drafts.filter(d => {
    if (d.status === "published") return false;
    if (!d.contentWordCount || d.contentWordCount === 0) return true;
    if (d.contentWordCount < 5000) return true;
    if (d.hasTBCMarker) return true;
    return false;
  });

  const fetchIllustrationNeeds = () => {
    fetch("/api/content-studio/illustration-needs", { headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setIllustrationNeeds(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const pollIllustrationProgress = () => {
    const interval = setInterval(() => {
      fetch("/api/content-studio/illustration-progress", { headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setIllustrationLiveProgress(data);
            if (!data.running) {
              clearInterval(interval);
              setIllustrationGenRunning(false);
              fetchIllustrationNeeds();
            }
          }
        })
        .catch(() => {});
    }, 5000);
    return interval;
  };

  const startIllustrationGen = () => {
    if (illustrationNeeds.length === 0) return;
    const ids = illustrationNeeds.map(n => n.id);
    setIllustrationGenRunning(true);
    fetch("/api/content-studio/illustrations-only", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      body: JSON.stringify({ draftIds: ids }),
    })
      .then(r => r.json())
      .then(data => {
        toast({ title: "Illustrations Queued", description: data.message || `${ids.length} books queued for illustration generation` });
        pollIllustrationProgress();
      })
      .catch(() => {
        toast({ title: "Error", description: "Failed to start illustration generation", variant: "destructive" });
        setIllustrationGenRunning(false);
      });
  };

  useEffect(() => {
    const token = localStorage.getItem("ebgz_admin_token") || "";
    fetch("/api/content-studio/content-gen-status", {
      headers: { "x-admin-token": token },
    })
      .then(r => r.json())
      .then(data => {
        if (data.running) {
          setContentGenRunning(true);
          setContentGenProgress(data);
          pollContentGenStatus();
        }
      })
      .catch(() => {});
    fetch("/api/content-studio/illustration-progress", {
      headers: { "x-admin-token": token },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.running) {
          setIllustrationLiveProgress(data);
          setIllustrationGenRunning(true);
        }
      })
      .catch(() => {});
    fetchIllustrationNeeds();
    const illustPollInterval = pollIllustrationProgress();
    return () => clearInterval(illustPollInterval);
  }, []);

  const anyGenRunning = contentGenRunning || illustrationLiveProgress.running || illustrationGenRunning;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Ready</Badge>;
      case "generating":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case "published":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30"><Upload className="h-3 w-3 mr-1" /> Published</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30"><Clock className="h-3 w-3 mr-1" /> {status}</Badge>;
    }
  };

  const activeJobs = jobs.filter(j => j.status === "processing" || j.status === "queued");
  const readyDrafts = drafts.filter(d => d.status === "ready");

  return (
    <div className="min-h-screen bg-background">
      {/* Always-visible stop controls — enabled when a job is running */}
      <div
        className={`sticky top-0 z-50 border-b px-4 py-2 ${anyGenRunning ? "border-red-500/50 bg-red-950/95" : "border-white/10 bg-background/95"} backdrop-blur`}
        data-testid="banner-emergency-stop-gen"
      >
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm ${anyGenRunning ? "text-red-100" : "text-muted-foreground"}`}>
            {contentGenRunning && illustrationLiveProgress.running
              ? "Writing/dialogue and illustrations are running — stop either one, or stop everything."
              : contentGenRunning
                ? "Writing / dialogue work is running."
                : illustrationLiveProgress.running || illustrationGenRunning
                  ? "Illustration generation is running."
                  : "Stop controls (enabled when a job is running)"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400/70 text-amber-200 h-8"
              onClick={stopContentGen}
              disabled={!contentGenRunning}
              data-testid="button-stop-writing-banner"
            >
              Stop writing/dialogue
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-purple-300/70 text-purple-100 h-8"
              onClick={stopIllustrationGen}
              disabled={!illustrationLiveProgress.running && !illustrationGenRunning}
              data-testid="button-stop-art-banner"
            >
              Stop art
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-8"
              onClick={stopAllGen}
              disabled={!anyGenRunning}
              data-testid="button-stop-all-gen"
            >
              <X className="h-4 w-4 mr-1" />
              Stop everything
            </Button>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="h-8 w-8 text-primary" />
                <h1 className="font-display text-4xl text-primary">Content Studio</h1>
              </div>
              <p className="text-muted-foreground font-serif">
                AI-powered ebook generation for your store
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a 
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                data-testid="link-home"
              >
                <Home className="h-4 w-4" />
                Home
              </a>
              <a 
                href="/batch-cover-review"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                data-testid="link-cover-review"
              >
                <ImageIcon className="h-4 w-4" />
                Cover Review
              </a>
            </div>
          </div>
        </motion.div>

        <Card className="mb-6 bg-amber-500/10 border-amber-500/30" data-testid="card-upgrade-reminder">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <ExternalLink className="h-5 w-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-200">Upgrade Reminder</p>
                <p className="text-xs text-amber-300/70">
                  Want AI to search for trending topics? 
                  <a 
                    href="https://www.perplexity.ai/settings/api" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-1 underline hover:text-amber-200"
                    data-testid="link-perplexity-upgrade"
                  >
                    Get Perplexity Pro ($20/mo)
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card/50 border-white/10" data-testid="card-ready-to-publish">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display text-primary">Ready to Publish</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-ready-count">{readyDrafts.length}</div>
              <p className="text-xs text-muted-foreground">ebooks awaiting approval</p>
            </CardContent>
          </Card>
          
          <Card className={`bg-card/50 ${contentGenRunning ? 'border-amber-500/50' : 'border-white/10'}`} data-testid="card-active-jobs">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display text-primary flex items-center justify-between gap-2">
                <span>Writing / Dialogue</span>
                {contentGenRunning && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-2 text-xs"
                    onClick={stopContentGen}
                    data-testid="button-stop-writing-card"
                  >
                    Stop writing
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contentGenRunning ? (
                <>
                  <div className="text-3xl font-bold text-amber-400" data-testid="text-active-jobs-count">
                    {contentGenProgress.completed}/{contentGenProgress.total}
                  </div>
                  <p className="text-xs text-amber-400/80">books — writing / dialogue in progress</p>
                  {contentGenProgress.current && (
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={`ID ${contentGenProgress.currentId}: ${contentGenProgress.current}`}>
                      Current: <span className="text-amber-300 font-mono">#{contentGenProgress.currentId}</span> {contentGenProgress.current.length > 35 ? contentGenProgress.current.substring(0, 35) + '...' : contentGenProgress.current}
                    </p>
                  )}
                  {contentGenProgress.nextTitle && (
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={`ID ${contentGenProgress.nextId}: ${contentGenProgress.nextTitle}`}>
                      <span className="text-yellow-400">★</span> Next: <span className="text-amber-300 font-mono">#{contentGenProgress.nextId}</span> {contentGenProgress.nextTitle.length > 35 ? contentGenProgress.nextTitle.substring(0, 35) + '...' : contentGenProgress.nextTitle}
                    </p>
                  )}
                  {contentGenProgress.failed.length > 0 && (
                    <p className="text-xs text-red-400 mt-1">{contentGenProgress.failed.length} failed</p>
                  )}
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold" data-testid="text-active-jobs-count">{activeJobs.length}</div>
                  <p className="text-xs text-muted-foreground">{activeJobs.length > 0 ? 'topic generation in progress' : 'no writing running'}</p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 border-white/10" data-testid="card-total-drafts">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display text-primary">Total Drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-total-drafts-count">{drafts.length}</div>
              <p className="text-xs text-muted-foreground">ebooks generated</p>
            </CardContent>
          </Card>

          <Card className={`bg-card/50 ${illustrationLiveProgress.running ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : illustrationNeeds.length > 0 ? 'border-purple-500/50' : 'border-white/10'}`} data-testid="card-illustration-needs">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display text-primary flex items-center gap-2">
                Illustrations
                {illustrationLiveProgress.running && (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                  </span>
                )}
                {illustrationNeeds.length > 0 && <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">{illustrationNeeds.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {illustrationLiveProgress.running ? (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                      <span className="text-sm font-semibold text-purple-400">Generating...</span>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      onClick={stopIllustrationGen}
                      data-testid="button-stop-illustrations"
                    >
                      Stop art
                    </Button>
                  </div>
                  <p className="text-xs text-purple-300 truncate mb-1" title={illustrationLiveProgress.bookTitle}>
                    Book {illustrationLiveProgress.completedBooks + 1}/{illustrationLiveProgress.totalBooks}: {illustrationLiveProgress.bookTitle.length > 30 ? illustrationLiveProgress.bookTitle.substring(0, 30) + '...' : illustrationLiveProgress.bookTitle}
                  </p>
                  {illustrationLiveProgress.totalImages > 0 && (
                    <>
                      <div className="w-full bg-purple-900/30 rounded-full h-2 mt-2">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.round((illustrationLiveProgress.currentImage / illustrationLiveProgress.totalImages) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-purple-400/80 mt-1">
                        Image {illustrationLiveProgress.currentImage}/{illustrationLiveProgress.totalImages}
                      </p>
                    </>
                  )}
                  {illustrationNeeds.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">{illustrationNeeds.length} book{illustrationNeeds.length > 1 ? 's' : ''} in queue</p>
                  )}
                </>
              ) : illustrationNeeds.length > 0 ? (
                <>
                  <div className="text-sm font-semibold text-purple-400 mb-1">{illustrationNeeds.length} books need illustrations</div>
                  <p className="text-[10px] text-muted-foreground mb-2">Select books, then choose an action below</p>
                  <div className="max-h-[200px] overflow-y-auto space-y-1 mb-2 border border-white/10 rounded p-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer hover:text-white pb-1 border-b border-white/5 mb-1">
                      <input
                        type="checkbox"
                        checked={selectedForRewrite.size === illustrationNeeds.length && illustrationNeeds.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedForRewrite(new Set(illustrationNeeds.map(n => n.id)));
                          else setSelectedForRewrite(new Set());
                        }}
                        className="accent-purple-500"
                        data-testid="checkbox-select-all"
                      />
                      Select All
                    </label>
                    {illustrationNeeds.map(n => (
                      <label key={n.id} className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={selectedForRewrite.has(n.id)}
                          onChange={(e) => {
                            const next = new Set(selectedForRewrite);
                            if (e.target.checked) next.add(n.id);
                            else next.delete(n.id);
                            setSelectedForRewrite(next);
                          }}
                          className="accent-purple-500"
                          data-testid={`checkbox-book-${n.id}`}
                        />
                        <span className="text-purple-300 font-mono">#{n.id}</span>
                        <span className="truncate flex-1" title={n.title}>{n.title.length > 24 ? n.title.substring(0, 24) + '...' : n.title}</span>
                        <span className={`shrink-0 text-[9px] px-1 rounded ${n.actionType === "illustrations-only" ? "bg-purple-500/20 text-purple-300" : "bg-amber-500/20 text-amber-300"}`}>
                          {n.actionType === "illustrations-only" ? "art only" : "rewrite"}
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedForRewrite.size > 0 && (
                    <div className="space-y-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const ids = Array.from(selectedForRewrite);
                          fetch("/api/content-studio/illustrations-only", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
                            body: JSON.stringify({ draftIds: ids }),
                          }).then(r => { if (r.ok) { setIllustrationGenRunning(true); pollIllustrationProgress(); setSelectedForRewrite(new Set()); } else { r.json().then(d => alert(d.error || "Failed")); } }).catch(() => alert("Network error"));
                        }}
                        disabled={illustrationGenRunning}
                        className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                        data-testid="button-bulk-art-only"
                      >
                        {illustrationGenRunning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ImageIcon className="h-3 w-3 mr-1" />}
                        {illustrationGenRunning ? 'Generating Art...' : `Art Only (${selectedForRewrite.size} selected)`}
                      </Button>
                      {selectedForRewrite.size > 0 && [...selectedForRewrite].some(id => illustrationNeeds.find(n => n.id === id)?.actionType === "rewrite-and-illustrate") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const ids = Array.from(selectedForRewrite).filter(id => illustrationNeeds.find(n => n.id === id)?.actionType === "rewrite-and-illustrate");
                          if (ids.length === 0) return;
                          fetch("/api/content-studio/rewrite-specific-drafts", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
                            body: JSON.stringify({ draftIds: ids }),
                          }).then(r => { if (r.ok) { setContentGenRunning(true); pollContentGenStatus(); setSelectedForRewrite(new Set()); } else { r.json().then(d => alert(d.error || "Failed")); } }).catch(() => alert("Network error"));
                        }}
                        disabled={illustrationGenRunning || contentGenRunning}
                        className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                        data-testid="button-bulk-rewrite-art"
                      >
                        {contentGenRunning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        {contentGenRunning ? 'Rewriting + Art...' : `Rewrite + Art (${[...selectedForRewrite].filter(id => illustrationNeeds.find(n => n.id === id)?.actionType === "rewrite-and-illustrate").length} selected)`}
                      </Button>
                      )}
                      {selectedForRewrite.size > 0 && (
                      <p className="text-[10px] text-muted-foreground">Art Only = images only (content unchanged). Rewrite + Art only shows for books that need a prose rewrite.</p>
                      )}
                    </div>
                  )}
                  {selectedForRewrite.size === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center">Check boxes above to enable actions</p>
                  )}
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-green-400" data-testid="text-illustration-count">0</div>
                  <p className="text-xs text-muted-foreground">all visual books have illustrations</p>
                </>
              )}
              <div className="border-t border-white/10 pt-3 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!confirm("This will scan all books for illustration images missing from cloud storage, reset those spots, and regenerate only the missing images. Continue?")) return;
                    fetch("/api/admin/illustrations/recover-missing", {
                      method: "POST",
                      headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
                    })
                      .then(r => r.json())
                      .then(d => {
                        if (d.success) {
                          if (d.affectedBooks > 0) {
                            alert(`Found ${d.missingFiles} missing files across ${d.affectedBooks} book(s). Regenerating now — watch the progress bar above.`);
                            setIllustrationGenRunning(true);
                            pollIllustrationProgress();
                            fetchIllustrationNeeds();
                          } else {
                            alert(d.message || "All illustrations are present in cloud storage.");
                          }
                        } else {
                          alert(d.error || "Recovery failed");
                        }
                      })
                      .catch(() => alert("Network error"));
                  }}
                  disabled={illustrationGenRunning || contentGenRunning}
                  className="w-full border-red-500/40 text-red-400 hover:bg-red-500/10"
                  data-testid="button-recover-missing-illustrations"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Recover Missing (cloud storage scan)
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">Scans for illustrations lost after server restarts and regenerates only the missing ones.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Page Formatting Tools ── */}
        <Card className="mb-8 bg-card/50 border-blue-500/30">
          <CardHeader>
            <CardTitle className="font-display text-xl text-blue-400 flex items-center gap-2">
              <AlignLeft className="h-5 w-5" />
              Page Formatting Tools
            </CardTitle>
            <CardDescription className="font-serif">
              Scan books for content issues that cause uneven pages, then apply fixes individually or all at once.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-4">
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                disabled={formatScanLoading || formatApplyLoading}
                data-testid="button-format-scan"
                onClick={async () => {
                  setFormatScanLoading(true);
                  setFormatApplyMsg(null);
                  setSelectedForFormat(new Set());
                  try {
                    const r = await fetch("/api/admin/format-scan", { headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" } });
                    const d = await r.json();
                    setFormatScanResults(d.results || []);
                  } catch { toast({ title: "Error", description: "Scan failed", variant: "destructive" }); }
                  finally { setFormatScanLoading(false); }
                }}
              >
                {formatScanLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
                {formatScanLoading ? "Scanning…" : "Scan All Books"}
              </Button>

              {formatScanResults && selectedForFormat.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                  disabled={formatApplyLoading}
                  data-testid="button-format-selected"
                  onClick={async () => {
                    setFormatApplyLoading(true); setFormatApplyMsg(null);
                    try {
                      const r = await fetch("/api/admin/format-content", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" }, body: JSON.stringify({ draftIds: Array.from(selectedForFormat) }) });
                      const d = await r.json();
                      setFormatApplyMsg(d.message || "Done");
                      setSelectedForFormat(new Set());
                    } catch { toast({ title: "Error", description: "Apply failed", variant: "destructive" }); }
                    finally { setFormatApplyLoading(false); }
                  }}
                >
                  {formatApplyLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckSquare className="h-3 w-3 mr-1" />}
                  Fix Selected ({selectedForFormat.size})
                </Button>
              )}

              {formatScanResults && formatScanResults.some((r: any) => r.hasIssues) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  disabled={formatApplyLoading}
                  data-testid="button-format-all"
                  onClick={async () => {
                    if (!confirm(`Apply formatting fixes to all books with issues? This modifies stored content.`)) return;
                    setFormatApplyLoading(true); setFormatApplyMsg(null);
                    try {
                      const ids = (formatScanResults || []).filter((r: any) => r.hasIssues).map((r: any) => r.id);
                      const r = await fetch("/api/admin/format-content", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" }, body: JSON.stringify({ draftIds: ids }) });
                      const d = await r.json();
                      setFormatApplyMsg(d.message || "Done");
                      setSelectedForFormat(new Set());
                    } catch { toast({ title: "Error", description: "Apply failed", variant: "destructive" }); }
                    finally { setFormatApplyLoading(false); }
                  }}
                >
                  {formatApplyLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <AlignLeft className="h-3 w-3 mr-1" />}
                  Fix All with Issues
                </Button>
              )}
            </div>

            {formatApplyMsg && (
              <div className="mb-3 px-3 py-2 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
                {formatApplyMsg}
              </div>
            )}

            {formatScanResults && (
              <div className="rounded border border-white/10 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 text-xs text-muted-foreground font-medium">
                  <span className="w-6" />
                  <span className="w-36 shrink-0">Title</span>
                  <span className="flex-1">Fix Strategy</span>
                  <span className="w-28 text-center">Issues Found</span>
                  <span className="w-16 text-center">Action</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                  {formatScanResults.filter((r: any) => r.hasIssues).length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-green-400">All books are clean — no formatting issues found.</div>
                  ) : (
                    formatScanResults.filter((r: any) => r.hasIssues).map((book: any) => (
                      <div key={book.id} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5">
                        <Checkbox
                          checked={selectedForFormat.has(book.id)}
                          onCheckedChange={checked => {
                            setSelectedForFormat(prev => {
                              const next = new Set(prev);
                              checked ? next.add(book.id) : next.delete(book.id);
                              return next;
                            });
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <span className="w-36 shrink-0 truncate text-foreground/90" title={book.title}>{book.title}</span>
                        <span className="flex-1 text-muted-foreground/80 italic truncate" title={book.profile}>{book.profile || book.genre}</span>
                        <span className="w-28 text-center">
                          {book.longParagraphs > 0 && <span className="text-amber-400 mr-1">{book.longParagraphs} long para{book.longParagraphs > 1 ? "s" : ""}</span>}
                          {book.orphanedNumbers > 0 && <span className="text-orange-400">{book.orphanedNumbers} orphan{book.orphanedNumbers > 1 ? "s" : ""}</span>}
                        </span>
                        <div className="w-16 flex justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-blue-400 hover:bg-blue-500/10"
                            disabled={formatApplyLoading}
                            onClick={async () => {
                              setFormatApplyLoading(true); setFormatApplyMsg(null);
                              try {
                                const r = await fetch("/api/admin/format-content", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" }, body: JSON.stringify({ draftIds: [book.id] }) });
                                const d = await r.json();
                                setFormatApplyMsg(d.message || "Done");
                                setFormatScanResults(prev => prev ? prev.map(b => b.id === book.id ? { ...b, hasIssues: false, longParagraphs: 0, orphanedNumbers: 0 } : b) : prev);
                              } catch { toast({ title: "Error", description: "Fix failed", variant: "destructive" }); }
                              finally { setFormatApplyLoading(false); }
                            }}
                          >
                            Fix
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-3 py-2 bg-white/5 text-xs text-muted-foreground border-t border-white/10">
                  {formatScanResults.filter((r: any) => r.hasIssues).length} of {formatScanResults.length} books have formatting issues
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8 bg-card/50 border-primary/30">
          <CardHeader>
            <CardTitle className="font-display text-xl text-primary flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Generate New Ebooks
            </CardTitle>
            <CardDescription className="font-serif">
              AI will create professional ebooks with content and covers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Genre</label>
                <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                  <SelectTrigger className="w-[200px] bg-black/20 border-white/10" data-testid="select-genre">
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {genres.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        <span className="flex items-center gap-1.5">
                          {genre}
                          {VISUAL_FIRST_GENRES.has(genre) && (
                            <AlertTriangle className="h-3 w-3 text-amber-400 inline" />
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedGenre && VISUAL_FIRST_GENRES.has(selectedGenre) && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 max-w-md" data-testid="visual-genre-info">
                    <Sparkles className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-300">
                      <span className="font-semibold">Visual-Enhanced Mode:</span> {selectedGenre} books will include AI-generated illustrations embedded throughout the content — example panels, technique demonstrations, and visual examples alongside the instructional text.
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Count</label>
                <Select value={count.toString()} onValueChange={(v) => setCount(parseInt(v))}>
                  <SelectTrigger className="w-[100px] bg-black/20 border-white/10" data-testid="select-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                onClick={() => selectedGenre && generateMutation.mutate({ genre: selectedGenre, count })}
                disabled={!selectedGenre || generateMutation.isPending}
                className="bg-primary hover:bg-primary/90"
                data-testid="button-generate-genre"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Generate for Genre
              </Button>
              
              <Button
                variant="outline"
                onClick={() => generateAllMutation.mutate(count)}
                disabled={generateAllMutation.isPending}
                className="border-primary/50 text-primary hover:bg-primary/10"
                data-testid="button-generate-all"
              >
                {generateAllMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate All Genres ({count} each)
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-muted-foreground">Idea / Description (optional — system generates title and content from your idea)</label>
                <div 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                    aiProvider === "replit" 
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-300" 
                      : "bg-secondary/50 border-border text-muted-foreground"
                  }`}
                  data-testid="toggle-ai-provider"
                >
                  <span className="text-xs font-medium">OpenAI</span>
                  <Switch 
                    checked={aiProvider === "replit"}
                    onCheckedChange={toggleAIProvider}
                    className="data-[state=checked]:bg-blue-500"
                  />
                  <span className="text-xs font-medium">Replit AI</span>
                </div>
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <textarea
                    ref={customDescriptionRef}
                    placeholder="Describe your book idea here... AI will expand on it, generate a title, and create the full book."
                    className="w-full h-24 bg-black/20 border border-white/10 rounded-md p-3 text-foreground placeholder:text-muted-foreground/50 font-body text-sm resize-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                    data-testid="input-custom-description"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Genre(s):</label>
                    <Input
                      value={customGenre}
                      onChange={(e) => setCustomGenre(e.target.value)}
                      placeholder="e.g. Drama, Drama / Romance, Horror / Thriller"
                      className="h-8 text-xs bg-black/20 border-white/10"
                      data-testid="input-custom-genre"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => {
                    const desc = customDescriptionRef.current?.value?.trim();
                    if (desc) customBookMutation.mutate({ description: desc, genre: customGenre.trim() || selectedGenre || undefined });
                  }}
                  disabled={customBookMutation.isPending}
                  className="bg-primary hover:bg-primary/90 whitespace-nowrap"
                  data-testid="button-create-from-idea"
                >
                  {customBookMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Create from Idea
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Push to Production Sync Panel */}
        <div className="border border-blue-500/30 rounded-lg bg-blue-900/10">
          <button
            onClick={() => setSyncToProductionOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-500/10 transition-colors"
            data-testid="button-toggle-prod-sync"
          >
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-300">Push to Production</span>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                {pushToProdCounts.pending === 0
                  ? "All caught up"
                  : `${pushToProdCounts.pending} need push`}
              </Badge>
            </div>
            <ChevronDown className={`h-4 w-4 text-blue-400 transition-transform ${syncToProductionOpen ? "rotate-180" : ""}`} />
          </button>
          {syncToProductionOpen && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-blue-200/70 leading-relaxed">
                Sends published book content from this computer to the live site. This does <strong className="text-blue-200">not</strong> deploy code.
                A book stays in “needs push” until it is verified on the live storefront with a cover.
              </p>
              {pushToProdCounts.pending > 0 && (
                <div
                  className="rounded-md border border-blue-500/30 bg-blue-950/30 px-3 py-2 text-xs text-blue-100/90"
                  data-testid="push-to-prod-pending-list"
                >
                  <p className="font-semibold text-blue-200 mb-1">
                    Needs to be pushed ({pushToProdCounts.pending})
                    {pushToProdCounts.neverPushed > 0 || pushToProdCounts.localChanges > 0 ? (
                      <span className="font-normal text-blue-200/70">
                        {" "}— {pushToProdCounts.neverPushed} never sent
                        {pushToProdCounts.localChanges > 0 ? `, ${pushToProdCounts.localChanges} changed since last send` : ""}
                      </span>
                    ) : null}
                  </p>
                  <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                    {pushToProdCounts.pendingDrafts.slice(0, 25).map((d) => (
                      <li key={d.id} className="flex gap-2">
                        <span className="text-blue-300/50 shrink-0">#{d.id}</span>
                        <span className="truncate">{d.title}</span>
                        <span className="shrink-0 text-blue-300/60">
                          {d.prodSyncReason === "local_changes" ? "changed" : "new"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {pushToProdCounts.pending > 25 && (
                    <p className="mt-1 text-blue-200/60">…and {pushToProdCounts.pending - 25} more</p>
                  )}
                  <p className="mt-2 text-blue-200/65">
                    Auto-push sends them in batches of {PUSH_TO_PROD_MAX} until this list is empty (or a book fails storefront check).
                  </p>
                </div>
              )}
              {pushToProdCounts.pending === 0 && (
                <p className="text-xs text-green-300/90" data-testid="push-to-prod-all-synced">
                  No published books are waiting to be pushed. If something is missing on ebookgamez.com, select it below and use Selected only.
                </p>
              )}
              {isOverPushLimit && (
                <div
                  className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-950/40 px-3 py-2 text-xs text-red-200"
                  data-testid="push-to-prod-over-limit-warning"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-300">Cannot push — over the {PUSH_TO_PROD_MAX}-book limit</p>
                    <p className="mt-0.5 text-red-200/80">
                      You selected {selectedIds.size} rows. Deselect down to {PUSH_TO_PROD_MAX} or fewer.
                    </p>
                  </div>
                </div>
              )}
              {!isOverPushLimit && pushReady && (
                <p className="text-xs text-green-300/90" data-testid="push-to-prod-count-preview">
                  {syncMode === "pending"
                    ? `Will push all ${pushToProdCounts.pending} pending book${pushToProdCounts.pending === 1 ? "" : "s"} to ${pushTargets.map(t => t.label).join(" + ")} (${PUSH_TO_PROD_MAX} per batch).`
                    : `Ready to push ${pushCountForMode} selected book${pushCountForMode === 1 ? "" : "s"} to ${pushTargets.map(t => t.label).join(" + ")}.`}
                </p>
              )}
              {pushDisabledReason && (
                <p className="text-xs text-amber-300/95" data-testid="push-to-prod-disabled-reason">
                  {pushDisabledReason}
                </p>
              )}
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem]">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Live site URL</Label>
                  <Input
                    value={productionUrl}
                    onChange={e => {
                      setProductionUrl(e.target.value);
                      localStorage.setItem("ebgz_prod_url", e.target.value);
                    }}
                    placeholder="https://ebookgamez.com"
                    className="bg-white/5 border-white/20 text-sm h-8"
                    data-testid="input-production-url"
                  />
                  {isLocalDevUrl(productionUrl) && (
                    <button
                      type="button"
                      className="text-[10px] text-amber-400 underline mt-1"
                      onClick={() => {
                        setProductionUrl(DEFAULT_PRODUCTION_URL);
                        localStorage.setItem("ebgz_prod_url", DEFAULT_PRODUCTION_URL);
                      }}
                    >
                      Fix: use https://ebookgamez.com instead
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground mb-1 block">Replit URL (optional)</Label>
                  <Input
                    value={replitUrl}
                    onChange={e => {
                      setReplitUrl(e.target.value);
                      localStorage.setItem("ebgz_replit_url", e.target.value);
                    }}
                    placeholder="https://your-app.replit.app"
                    className="bg-white/5 border-white/20 text-sm h-8"
                    data-testid="input-replit-url"
                  />
                  {isLocalDevUrl(replitUrl) && (
                    <button
                      type="button"
                      className="text-[10px] text-amber-400 underline mt-1"
                      onClick={() => {
                        setReplitUrl("");
                        localStorage.setItem("ebgz_replit_url", "");
                      }}
                    >
                      Clear localhost Replit URL
                    </button>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">What to sync</Label>
                  <select
                    value={syncMode}
                    onChange={e => setSyncMode(e.target.value as ProdSyncMode)}
                    className="w-full h-8 rounded-md border border-white/20 bg-background text-sm px-2"
                    data-testid="select-sync-mode"
                  >
                    <option value="pending">
                      All that need push ({pushToProdCounts.pending})
                    </option>
                    <option value="selected">Selected only ({pushToProdCounts.selected})</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  onClick={async () => {
                    if (!pushReady) return;
                    setIsSyncing(true);
                    setSyncResult(null);
                    setAutoSyncProgress(null);
                    try {
                      const selectedDraftIds = Array.from(selectedIds);
                      const targetResults: { label: string; data: NonNullable<typeof syncResult> }[] = [];
                      let totalPushed = 0;
                      let totalBatches = 0;

                      if (syncMode === "pending") {
                        for (const target of pushTargets) {
                          const result = await autoPushPendingToUrl(target.url, target.label);
                          totalPushed += result.totalPushed;
                          totalBatches += result.batches;
                          if (result.lastData) targetResults.push({ label: target.label, data: result.lastData });
                        }
                      } else {
                        for (const target of pushTargets) {
                          const data = await pushOneBatchToUrl(target.url, "selected", selectedDraftIds);
                          totalPushed += data.totalDrafts ?? 0;
                          totalBatches++;
                          targetResults.push({ label: target.label, data });
                        }
                      }

                      const lastResult = targetResults[targetResults.length - 1]?.data;
                      const warnings = targetResults.flatMap(result =>
                        (result.data.warnings ?? []).map(warning => `${result.label}: ${warning}`)
                      );
                      const summary = summarizePushVerification(lastResult);
                      const hasProblems = !summary.trulyDone || warnings.length > 0 || targetResults.some(result =>
                        !result.data.ok || (result.data.totalErrors ?? 0) > 0
                      );
                      const targetLabels = pushTargets.map(t => t.label).join(" + ");
                      const missingNames = summary.missing.map(v => v.title).slice(0, 5);
                      const message = hasProblems
                        ? `Push finished with issues: ${totalPushed} book(s) in ${totalBatches} batch(es) to ${targetLabels}.`
                          + (summary.missing.length ? ` ${summary.missing.length} not on storefront${missingNames.length ? ` (${missingNames.join("; ")}${summary.missing.length > missingNames.length ? "…" : ""})` : ""}.` : "")
                          + (summary.remainingPending > 0 ? ` ${summary.remainingPending} still need push.` : "")
                        : syncMode === "pending"
                          ? `All pending books pushed: ${totalPushed} book(s) in ${totalBatches} batch(es) to ${targetLabels}.`
                          : `Selected books pushed: ${totalPushed} to ${targetLabels}.`;

                      setSyncResult({
                        ...(lastResult ?? {
                          totalDrafts: 0,
                          totalUpdated: 0,
                          totalInserted: 0,
                          totalErrors: 0,
                          message,
                        }),
                        ok: !hasProblems,
                        message,
                        warnings: warnings.length > 0 ? warnings : lastResult?.warnings,
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
                      toast({
                        title: hasProblems ? "Push finished with issues" : "Push complete",
                        description: warnings.length > 0 ? `${message}\n\n${warnings.slice(0, 3).join("\n")}` : message,
                        variant: hasProblems ? "destructive" : "default",
                      });
                    } catch (e: any) {
                      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
                    } finally {
                      setIsSyncing(false);
                      setAutoSyncProgress(null);
                    }
                  }}
                  disabled={!pushReady}
                  title={pushDisabledReason ?? "Push books to live site and optional Replit target"}
                  className="bg-blue-600 hover:bg-blue-500 text-white h-8 px-4 text-sm whitespace-nowrap"
                  data-testid="button-push-live-and-replit"
                >
                  {isSyncing && autoSyncProgress ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" />{autoSyncProgress.target ?? "Target"} batch {autoSyncProgress.batch}…</>
                  ) : isSyncing ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" />Syncing…</>
                  ) : (
                    <><Upload className="h-3 w-3 mr-1" />{syncMode === "pending" ? "Push all that need it" : "Push selected"}</>
                  )}
                </Button>
                <Button
                  onClick={async () => {
                    const liveUrl = normalizeProdUrl(productionUrl);
                    if (!liveUrl || isLocalDevUrl(liveUrl)) {
                      toast({ title: "Enter your production URL first", variant: "destructive" });
                      return;
                    }
                    if (pushToProdCounts.pending === 0) {
                      toast({ title: "Nothing to sync", description: "All published books are already synced.", variant: "destructive" });
                      return;
                    }
                    setIsSyncing(true);
                    setSyncResult(null);
                    setAutoSyncProgress(null);
                    try {
                      const result = await autoPushPendingToUrl(liveUrl, "Live site");
                      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
                      const summary = summarizePushVerification(result.lastData);
                      const missingNames = summary.missing.map(v => v.title);
                      let message = `Pushed ${result.totalPushed} book(s) in ${result.batches} batch(es).`;
                      if (summary.missing.length > 0) {
                        message += ` Stopped: ${summary.missing.length} not on storefront — ${missingNames.join("; ")}.`;
                      } else if (summary.remainingPending > 0) {
                        message += ` ${summary.remainingPending} still need push.`;
                      } else {
                        message += " All pending books are on the live storefront.";
                      }
                      if (result.lastData) {
                        setSyncResult({
                          ...result.lastData,
                          message,
                          ok: summary.trulyDone,
                        });
                      }
                      toast({
                        title: summary.trulyDone ? "Auto-push complete" : "Auto-push stopped — fix these first",
                        description: message,
                        variant: summary.trulyDone ? "default" : "destructive",
                      });
                    } catch (e: any) {
                      toast({ title: "Auto-push failed", description: e.message, variant: "destructive" });
                    } finally {
                      setIsSyncing(false);
                      setAutoSyncProgress(null);
                    }
                  }}
                  disabled={isSyncing || !normalizeProdUrl(productionUrl) || isLocalDevUrl(productionUrl) || pushToProdCounts.pending === 0}
                  title={`Push every book that still needs production sync, ${PUSH_TO_PROD_MAX} at a time, until the list is empty`}
                  variant="outline"
                  className="border-blue-500/40 text-blue-200 hover:bg-blue-500/10 h-8 px-4 text-sm whitespace-nowrap"
                  data-testid="button-auto-push-live"
                >
                  {autoSyncProgress ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" />{autoSyncProgress.pushed} done · ~{autoSyncProgress.remaining} left</>
                  ) : (
                    <>Push all that need it ({pushToProdCounts.pending})</>
                  )}
                </Button>
              </div>
              {syncMode === "selected" && selectedIds.size > 0 && (
                <p className="text-xs text-blue-200/60">
                  Will push draft IDs: {Array.from(selectedIds).slice(0, 12).join(", ")}{selectedIds.size > 12 ? ` … +${selectedIds.size - 12} more` : ""}
                </p>
              )}
              {syncResult && (
                <div className={`rounded px-3 py-2 text-xs ${syncResult.ok ? "bg-green-900/20 border border-green-500/30 text-green-300" : "bg-amber-900/20 border border-amber-500/40 text-amber-200"}`}>
                  <p>{syncResult.ok ? "Done:" : "Needs attention:"} {syncResult.message}</p>
                  {(() => {
                    const summary = summarizePushVerification(syncResult);
                    if (summary.verification.length === 0) return null;
                    return (
                      <div className="mt-2 space-y-1">
                        {summary.onStorefront.length > 0 && (
                          <p className="text-green-300/90">
                            On storefront ({summary.onStorefront.length}): {summary.onStorefront.map(v => v.title).slice(0, 8).join("; ")}
                            {summary.onStorefront.length > 8 ? "…" : ""}
                          </p>
                        )}
                        {summary.missing.length > 0 && (
                          <p className="text-amber-200 font-medium">
                            Still need push / not on storefront ({summary.missing.length}): {summary.missing.map(v => v.title).join("; ")}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  {syncResult.warnings?.map((w, i) => (
                    <p key={i} className="mt-1 text-amber-300/90">{w}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Tabs defaultValue="drafts" className="space-y-4">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="drafts" className="data-[state=active]:bg-primary/20" data-testid="tab-drafts">
              <BookOpen className="h-4 w-4 mr-2" />
              Drafts ({drafts.length})
            </TabsTrigger>
            <TabsTrigger value="jobs" className="data-[state=active]:bg-primary/20" data-testid="tab-jobs">
              <Clock className="h-4 w-4 mr-2" />
              Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="cover-preview" className="data-[state=active]:bg-primary/20" data-testid="tab-cover-preview">
              <Eye className="h-4 w-4 mr-2" />
              Cover Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="drafts">
            <Card className="bg-card/50 border-white/10">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-row items-center justify-between">
                    <CardTitle className="font-display text-lg text-primary">Draft Ebooks</CardTitle>
                    <div className="flex gap-2 items-center">
                      <label className="flex items-center gap-1.5 text-xs text-purple-300 cursor-pointer select-none" data-testid="toggle-auto-exclusive">
                        <input
                          type="checkbox"
                          checked={autoExclusive}
                          onChange={(e) => setAutoExclusive(e.target.checked)}
                          className="accent-purple-500 w-3.5 h-3.5"
                        />
                        30-day exclusive
                      </label>
                      <Button
                        onClick={() => publishAllMutation.mutate()}
                        disabled={publishAllMutation.isPending || readyDrafts.length === 0}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-publish-all"
                      >
                        {publishAllMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Sweep & Publish ({readyDrafts.length})
                      </Button>
                      <Button
                        onClick={() => auditPublishedMutation.mutate()}
                        disabled={auditPublishedMutation.isPending || publishedDrafts.length === 0}
                        variant="outline"
                        className="border-amber-500 text-amber-400 hover:bg-amber-500/10"
                        data-testid="button-audit-published"
                      >
                        {auditPublishedMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Search className="h-4 w-4 mr-2" />
                        )}
                        Audit Published ({publishedDrafts.length})
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => deleteAllMutation.mutate()}
                        disabled={deleteAllMutation.isPending || drafts.length === 0}
                        data-testid="button-delete-all"
                      >
                        {deleteAllMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete All ({drafts.length})
                      </Button>
                    </div>
                  </div>

                  {/* Publish Rejection Details */}
                  {publishDetails && publishDetails.some(d => d.action.startsWith("failed")) && (
                    <div className="border border-red-500/30 rounded-lg bg-red-900/10 p-3">
                      <button
                        className="flex items-center gap-2 w-full text-left"
                        onClick={() => setShowPublishDetails(v => !v)}
                        data-testid="button-toggle-publish-details"
                      >
                        <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-red-300">
                          {publishDetails.filter(d => d.action.startsWith("failed")).length} books failed quality gate — click to {showPublishDetails ? "hide" : "see"} details
                        </span>
                        <ChevronDown className={`h-4 w-4 text-red-400 ml-auto transition-transform ${showPublishDetails ? "rotate-180" : ""}`} />
                      </button>
                      {showPublishDetails && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                          {publishDetails.filter(d => d.action.startsWith("failed")).map(item => (
                            <div key={item.id} className="bg-black/30 rounded p-2 border border-red-500/20">
                              <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                              {item.issues && item.issues.length > 0 && (
                                <ul className="mt-1 space-y-0.5">
                                  {item.issues.map((issue, i) => (
                                    <li key={i} className="text-[11px] text-red-300 flex items-start gap-1">
                                      <span className="mt-0.5 flex-shrink-0">•</span>
                                      <span>{issue}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bulk Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-sm text-muted-foreground mr-2">
                      {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select items for bulk actions"}
                      {selectedIds.size > PUSH_TO_PROD_MAX && (
                        <span className="text-amber-400/90"> — Push to Production allows max {PUSH_TO_PROD_MAX}; downloads are unlimited</span>
                      )}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={selectAll}
                      className="border-white/20"
                      data-testid="button-select-all"
                    >
                      {selectedIds.size === bulkSelectableDrafts.length && bulkSelectableDrafts.length > 0 ? "Deselect All" : `Select All (${bulkSelectableDrafts.length})`}
                    </Button>
                    {selectedIds.size > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateSelectedContentMutation.mutate(Array.from(selectedIds))}
                        disabled={generateSelectedContentMutation.isPending || contentGenRunning}
                        className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                        data-testid="button-write-selected-content"
                      >
                        {contentGenRunning ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <BookOpen className="h-4 w-4 mr-1" />
                        )}
                        Write/Rewrite Selected ({selectedIds.size})
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateMissingContentMutation.mutate()}
                      disabled={generateMissingContentMutation.isPending || contentGenRunning || draftsWithoutContent.length === 0}
                      className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                      data-testid="button-generate-missing-content"
                    >
                      {contentGenRunning ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <BookOpen className="h-4 w-4 mr-1" />
                      )}
                      {contentGenRunning ? `Writing... (${contentGenProgress.completed}/${contentGenProgress.total})` : `Write Missing Content (${draftsWithoutContent.length})`}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rewriteIncompleteMutation.mutate()}
                      disabled={rewriteIncompleteMutation.isPending || contentGenRunning || draftsIncomplete.length === 0}
                      className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                      data-testid="button-rewrite-incomplete"
                    >
                      {contentGenRunning ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      )}
                      {contentGenRunning ? `Rewriting...` : `Rewrite Incomplete (${draftsIncomplete.length})`}
                    </Button>
                    {contentGenRunning && contentGenProgress.current && (
                      <div className="flex flex-col gap-1 ml-2 text-xs text-muted-foreground max-w-[350px]">
                        <p className="truncate" title={`ID ${contentGenProgress.currentId}: ${contentGenProgress.current}`}>
                          📝 <span className="text-amber-300 font-mono">#{contentGenProgress.currentId}</span> {contentGenProgress.current.length > 30 ? contentGenProgress.current.substring(0, 30) + '...' : contentGenProgress.current}
                        </p>
                        {contentGenProgress.nextTitle && (
                          <p className="truncate" title={`ID ${contentGenProgress.nextId}: ${contentGenProgress.nextTitle}`}>
                            <span className="text-yellow-400">★</span> Next: <span className="text-amber-300 font-mono">#{contentGenProgress.nextId}</span> {contentGenProgress.nextTitle.length > 30 ? contentGenProgress.nextTitle.substring(0, 30) + '...' : contentGenProgress.nextTitle}
                          </p>
                        )}
                      </div>
                    )}
                    {contentGenRunning && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={stopContentGen}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        data-testid="button-stop-content-gen"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Stop writing/dialogue
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={fetchImportableBooks}
                      className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                      data-testid="button-import-from-catalog"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Import from Catalog
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={downloadTitlesList}
                      className="border-white/20"
                      data-testid="button-download-titles"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Download Titles List
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={downloadCoversWithTitles}
                      className="border-white/20"
                      data-testid="button-download-covers-titles-text"
                      title="Download text file with cover URLs and titles"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Titles (Text)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { window.location.href = "/api/content-studio/download-covers-with-titles-zip"; }}
                      className="border-white/20"
                      data-testid="button-download-covers-titles-zip"
                      title="Download ZIP with cover images and titles"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Titles + Images (ZIP)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={downloadCoversWithContent}
                      className="border-white/20"
                      data-testid="button-download-covers-content-text"
                      title="Download text file with cover URLs and content"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Content (Text)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { window.location.href = "/api/content-studio/download-covers-with-content-zip"; }}
                      className="border-white/20"
                      data-testid="button-download-covers-content-zip"
                      title="Download ZIP with cover images and full content"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Content + Images (ZIP)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { window.location.href = "/api/content-studio/download-epubs-zip"; }}
                      className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                      data-testid="button-download-all-epubs"
                      title="Download all ebooks as EPUB files in a ZIP"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      All EPUBs (ZIP)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (selectedIds.size === 0) {
                          toast({ title: "No ebooks selected", description: "Select ebooks to download as EPUB", variant: "destructive" });
                          return;
                        }
                        window.location.href = `/api/content-studio/download-epubs-zip?ids=${Array.from(selectedIds).join(",")}`;
                      }}
                      disabled={selectedIds.size === 0}
                      className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                      data-testid="button-download-selected-epubs"
                      title="Download selected ebooks as EPUB files in a ZIP"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Selected EPUBs ({selectedIds.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (selectedWithCovers.length === 0) {
                          toast({ title: "No covers selected", description: "Select drafts with covers to download", variant: "destructive" });
                          return;
                        }
                        window.location.href = `/api/content-studio/download-covers-zip?ids=${selectedWithCovers.join(",")}`;
                      }}
                      disabled={selectedWithCovers.length === 0}
                      className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                      data-testid="button-download-selected-covers"
                    >
                      <Package className="h-4 w-4 mr-1" />
                      Download Covers ({selectedWithCovers.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setUploadType("covers");
                        setIsUploadOpen(true);
                      }}
                      className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                      data-testid="button-upload-covers"
                    >
                      <FileUp className="h-4 w-4 mr-1" />
                      Upload Covers
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (selectedWithPdfs.length === 0) {
                          toast({ title: "No PDFs selected", description: "Select drafts with PDFs to download", variant: "destructive" });
                          return;
                        }
                        window.location.href = `/api/content-studio/download-pdfs-zip?ids=${selectedWithPdfs.join(",")}`;
                      }}
                      disabled={selectedWithPdfs.length === 0}
                      className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                      data-testid="button-download-selected-pdfs"
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Download PDFs ({selectedWithPdfs.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setUploadType("pdfs");
                        setIsUploadOpen(true);
                      }}
                      className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                      data-testid="button-upload-pdfs"
                    >
                      <FileUp className="h-4 w-4 mr-1" />
                      Upload PDFs
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {contentGenRunning && (
                <div className="mx-6 mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg" data-testid="content-gen-progress">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                    <span className="text-sm text-amber-400 font-medium">
                      Writing content: {contentGenProgress.completed}/{contentGenProgress.total}
                    </span>
                    {contentGenProgress.current && (
                      <span className="text-xs text-amber-400/70 truncate max-w-[300px]">— {contentGenProgress.current}</span>
                    )}
                  </div>
                  <Progress value={contentGenProgress.total > 0 ? (contentGenProgress.completed / contentGenProgress.total) * 100 : 0} className="h-2" />
                  {contentGenProgress.failed.length > 0 && (
                    <p className="text-xs text-red-400 mt-1">{contentGenProgress.failed.length} failed</p>
                  )}
                </div>
              )}
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by title, genre, or ID..."
                      value={studioSearchQuery}
                      onChange={(e) => setStudioSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-9 py-2 text-sm text-white bg-white/5 border border-white/10 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                      data-testid="input-search-studio"
                    />
                    {studioSearchQuery && (
                      <button onClick={() => setStudioSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                  {studioSearchQuery && (
                    <p className="text-xs text-muted-foreground mt-1">{filteredDrafts.length} of {drafts.length} ebooks found</p>
                  )}
                </div>
                {draftsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : drafts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-serif">No drafts yet. Start generating!</p>
                  </div>
                ) : (
                  <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedIds.size === bulkSelectableDrafts.length && bulkSelectableDrafts.length > 0}
                            onCheckedChange={selectAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                        <TableHead className="w-10 text-primary font-display">I.D. #</TableHead>
                        <TableHead className="text-primary font-display">Cover</TableHead>
                        <TableHead className="text-primary font-display">Title</TableHead>
                        <TableHead className="text-primary font-display">Genre</TableHead>
                        <TableHead className="text-primary font-display">Price</TableHead>
                        <TableHead className="text-primary font-display">Content</TableHead>
                        <TableHead className="text-primary font-display">Status</TableHead>
                        <TableHead className="text-right text-primary font-display">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpublishedDrafts.length === 0 && !studioSearchQuery ? (
                        <TableRow className="border-white/10">
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No unpublished drafts. All books are published!
                          </TableCell>
                        </TableRow>
                      ) : unpublishedDrafts.length === 0 && studioSearchQuery ? (
                        <TableRow className="border-white/10">
                          <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                            No unpublished drafts match your search.
                            {publishedDrafts.length > 0 && (
                              <button
                                onClick={() => publishedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                                className="ml-2 text-green-400 underline text-sm hover:text-green-300"
                              >
                                Found {publishedDrafts.length} published book{publishedDrafts.length !== 1 ? "s" : ""} ↓
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : unpublishedDrafts.map((draft, index) => (
                        <TableRow key={draft.id} className="border-white/10 hover:bg-white/5 cursor-pointer" onDoubleClick={() => openEditDialog(draft)} data-testid={`row-draft-${draft.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(draft.id)}
                              onCheckedChange={() => toggleSelection(draft.id)}
                              disabled={!isDraftSelectable(draft)}
                              data-testid={`checkbox-draft-${draft.id}`}
                            />
                          </TableCell>
                          <DraftIdCell
                            draftId={draft.id}
                            queueStar={contentGenRunning && contentGenProgress.nextId === draft.id}
                          />
                                <TableCell>
                                  <DraftCoverThumb
                                    coverUrl={draft.coverUrl}
                                    backgroundUrl={draft.backgroundUrl}
                                    alt={draft.title}
                                    className="w-12 h-16 object-cover rounded"
                                  />
                                </TableCell>
                                <TableCell className="font-serif max-w-[200px] truncate">
                                  <span className="flex items-center gap-1">
                                    {draft.title}
                                    {exemptSet.has(draft.id) && (
                                      <span title="Illustration-exempt — images skipped to save costs" className="inline-flex items-center ml-1">
                                        <ImageOff className="h-3.5 w-3.5 text-red-400" />
                                      </span>
                                    )}
                                  </span>
                                </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-white/20">
                              {draft.genre}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            ${draft.suggestedPrice || "—"}
                          </TableCell>
                          <TableCell>
                            {(draft.contentWordCount || 0) > 0 ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  {(draft.contentWordCount || 0).toLocaleString()} words
                                </Badge>
                            ) : (
                              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                <Clock className="h-3 w-3 mr-1" />
                                No content
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 flex-wrap">
                              {getStatusBadge(draft.status)}
                              {illustrationNeeds.some(n => n.id === draft.id) && (
                                <>
                                  {(() => {
                                    const need = illustrationNeeds.find(n => n.id === draft.id);
                                    return (
                                      <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      fetch("/api/content-studio/illustrations-only", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
                                        body: JSON.stringify({ draftIds: [draft.id] }),
                                      }).then(r => { if (r.ok) { setIllustrationGenRunning(true); pollIllustrationProgress(); } else { r.json().then(d => alert(d.error || "Failed")); } }).catch(() => alert("Network error"));
                                    }}
                                    disabled={illustrationGenRunning}
                                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-[10px] px-1.5 h-6"
                                    data-testid={`button-art-only-${draft.id}`}
                                    title={need?.reason || "Add art only — content stays the same"}
                                  >
                                    <ImageIcon className="h-3 w-3 mr-0.5" /> Art Only
                                  </Button>
                                  {need?.actionType === "rewrite-and-illustrate" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      fetch("/api/content-studio/rewrite-specific-drafts", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
                                        body: JSON.stringify({ draftIds: [draft.id] }),
                                      }).then(r => { if (r.ok) { setContentGenRunning(true); pollContentGenStatus(); } else { r.json().then(d => alert(d.error || "Failed")); } }).catch(() => alert("Network error"));
                                    }}
                                    disabled={illustrationGenRunning || contentGenRunning}
                                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 text-[10px] px-1.5 h-6"
                                    data-testid={`button-rewrite-art-${draft.id}`}
                                    title="Rewrite content + add art — for books written like novels"
                                  >
                                    <RefreshCw className="h-3 w-3 mr-0.5" /> Rewrite + Art
                                  </Button>
                                  )}
                                      </>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {(draft.coverUrl || draft.backgroundUrl) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDownloadCover(draft.id)}
                                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                  data-testid={`button-download-${draft.id}`}
                                  title="Download Cover"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditDialog(draft)}
                                className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                                data-testid={`button-edit-${draft.id}`}
                                title="Edit Title & Price"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {(draft.coverUrl || draft.backgroundUrl) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openStyleSelector(draft.id)}
                                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                                  data-testid={`button-style-${draft.id}`}
                                  title="Regenerate with Style"
                                >
                                  <Sparkles className="h-4 w-4" />
                                </Button>
                              )}
                              {(draft.contentWordCount || 0) > 50 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => { window.location.href = `/api/content-studio/download-epub/${draft.id}`; }}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                  data-testid={`button-download-epub-${draft.id}`}
                                  title="Download as EPUB"
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                              )}
                              {(draft.contentWordCount || 0) > 500 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    setMetricsModal({ draftId: draft.id, title: draft.title || "Untitled" });
                                    setMetricsData(null);
                                    setMetricsLoading(true);
                                    try {
                                      const r = await fetch(`/api/content-studio/pro-writing-metrics/${draft.id}`, {
                                        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" }
                                      });
                                      setMetricsData(await r.json());
                                    } catch { setMetricsData({ error: "Failed to load metrics" }); }
                                    finally { setMetricsLoading(false); }
                                  }}
                                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                  data-testid={`button-metrics-${draft.id}`}
                                  title="ProWriting Quality Metrics"
                                >
                                  <BarChart2 className="h-4 w-4" />
                                </Button>
                              )}
                              {(draft.contentWordCount || 0) > 500 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={antiAiPassIds.has(draft.id)}
                                  onClick={async () => {
                                    if (!confirm(`Run Anti-AI Polish on "${draft.title}"? This will rewrite paragraphs containing AI-tell phrases to sound more human. This may take a few minutes.`)) return;
                                    setAntiAiPassIds(prev => new Set([...prev, draft.id]));
                                    try {
                                      const r = await fetch(`/api/content-studio/anti-ai-pass/${draft.id}`, {
                                        method: "POST",
                                        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" }
                                      });
                                      const data = await r.json();
                                      toast({ title: data.changesCount > 0 ? "✅ Anti-AI Polish Complete" : "✓ Already Clean", description: data.message });
                                    } catch { toast({ title: "Error", description: "Anti-AI pass failed", variant: "destructive" }); }
                                    finally { setAntiAiPassIds(prev => { const s = new Set(prev); s.delete(draft.id); return s; }); }
                                  }}
                                  className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                                  data-testid={`button-anti-ai-${draft.id}`}
                                  title="Anti-AI Polish — remove AI-tell phrases"
                                >
                                  {antiAiPassIds.has(draft.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReviewDraft(draft);
                                  setReviewFullContent(null);
                                  setReviewFullOutline(null);
                                  setIsReviewOpen(true);
                                  fetch(`/api/content-studio/drafts/${draft.id}`, {
                                    headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" }
                                  }).then(r => r.json()).then(data => {
                                    setReviewFullContent(data.content || null);
                                    setReviewFullOutline(data.outline || null);
                                  }).catch(() => {});
                                }}
                                className="border-white/20 hover:bg-white/10"
                                data-testid={`button-review-${draft.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                              {(draft.contentWordCount || 0) > 50 && (
                                <a href={`/read/${draft.id}`} target="_blank" rel="noopener noreferrer">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-amber-500/30 hover:bg-amber-900/30 text-amber-300"
                                    data-testid={`button-read-${draft.id}`}
                                    title="Read this book in page-turning reader"
                                  >
                                    <BookOpen className="h-4 w-4 mr-1" />
                                    Read
                                  </Button>
                                </a>
                              )}
                              {((draft.contentWordCount || 0) === 0 || draft.status === "failed" || (draft.contentWordCount || 0) < 500) && (
                                <Button
                                  size="sm"
                                  onClick={() => openRewriteConfirm(draft)}
                                  disabled={rewritingDraftIds.has(draft.id)}
                                  className="bg-amber-600 hover:bg-amber-700 text-white"
                                  data-testid={`button-write-content-${draft.id}`}
                                  title="Write full story/content for this ebook using AI"
                                >
                                  {rewritingDraftIds.has(draft.id) ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <BookOpen className="h-4 w-4 mr-1" />
                                  )}
                                  {(draft.contentWordCount || 0) > 0 ? "Rewrite" : "Write Content"}
                                </Button>
                              )}
                              {draft.status === "generating" && (
                                <Button
                                  size="sm"
                                  onClick={() => resetAndRestart(draft.id)}
                                  className="bg-orange-600 hover:bg-orange-700 text-white"
                                  data-testid={`button-reset-stuck-${draft.id}`}
                                  title="Reset this stuck generation so you can restart it"
                                >
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  Reset Stuck
                                </Button>
                              )}
                              {(draft as any).needsContinuation && draft.status !== "generating" && (
                                <Button
                                  size="sm"
                                  onClick={() => continueWriting(draft.id)}
                                  disabled={continuingDraftIds.has(draft.id) || rewritingDraftIds.has(draft.id)}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  data-testid={`button-continue-writing-${draft.id}`}
                                  title={`${(draft as any).writtenChapterCount}/${(draft as any).outlineChapterCount || '?'} chapters written — pick up where it left off`}
                                >
                                  {continuingDraftIds.has(draft.id) ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4 mr-1" />
                                  )}
                                  Continue ({(draft as any).writtenChapterCount}/{(draft as any).outlineChapterCount || '?'})
                                </Button>
                              )}
                              {(draft.contentWordCount || 0) >= 500 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRewriteConfirm(draft)}
                                  disabled={rewritingDraftIds.has(draft.id) || continuingDraftIds.has(draft.id)}
                                  className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                  data-testid={`button-rewrite-content-${draft.id}`}
                                  title="Start over from scratch — completely rewrite this book's content"
                                >
                                  {rewritingDraftIds.has(draft.id) ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                  )}
                                  Rewrite
                                </Button>
                              )}
                              {(draft.contentWordCount || 0) >= 500 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateIllustrations(draft.id)}
                                  disabled={illustratingDraftIds.has(draft.id) || illustrationGenRunning}
                                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                                  data-testid={`button-illustrations-${draft.id}`}
                                  title="Generate AI illustrations for this book"
                                >
                                  {illustratingDraftIds.has(draft.id) ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <ImageIcon className="h-4 w-4 mr-1" />
                                  )}
                                  Illustrations
                                </Button>
                              )}
                              {(draft.status === "ready" || (draft.status === "draft" && (draft.contentWordCount || 0) > 50)) && (
                                <Button
                                  size="sm"
                                  onClick={() => publishMutation.mutate(draft.id)}
                                  disabled={publishMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                  data-testid={`button-publish-${draft.id}`}
                                >
                                  <Upload className="h-4 w-4 mr-1" />
                                  Publish
                                </Button>
                              )}
                              {(draft.contentWordCount || 0) >= 500 && (
                                <div className="relative">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      if (openSectionPicker === draft.id) {
                                        setOpenSectionPicker(null);
                                      } else {
                                        setOpenSectionPicker(draft.id);
                                        if (!draftSections[draft.id]) loadSectionsForDraft(draft.id);
                                      }
                                    }}
                                    className="border-cyan-500/30 hover:bg-cyan-900/30 text-cyan-300"
                                    data-testid={`button-section-rewrite-${draft.id}`}
                                    title="Rewrite a specific chapter or section"
                                  >
                                    <Scissors className="h-4 w-4 mr-1" />
                                    Section
                                  </Button>
                                  {openSectionPicker === draft.id && (
                                    <div className="absolute top-full right-0 mt-1 z-50 bg-stone-900 border border-white/20 rounded-lg shadow-xl p-3 min-w-[320px]" data-testid={`section-picker-${draft.id}`}>
                                      <p className="text-xs text-cyan-300 font-medium mb-2">Rewrite Section</p>
                                      {!draftSections[draft.id] ? (
                                        <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading sections...</div>
                                      ) : draftSections[draft.id].length === 0 ? (
                                        <p className="text-xs text-gray-500 py-2">No sections found</p>
                                      ) : (
                                        <>
                                          <select
                                            value={draftSectionNum[draft.id] ?? draftSections[draft.id][0]?.number ?? 0}
                                            onChange={(e) => setDraftSectionNum(prev => ({ ...prev, [draft.id]: parseInt(e.target.value) }))}
                                            className="w-full bg-stone-800 border border-white/20 rounded px-2 py-1.5 text-xs text-white mb-2 focus:border-cyan-500 focus:outline-none"
                                          >
                                            {draftSections[draft.id].map((s) => (
                                              <option key={s.number} value={s.number}>
                                                {s.number === 0 ? "About this Book" : `Ch ${s.number}`} — {s.title.length > 35 ? s.title.substring(0, 35) + "..." : s.title} ({s.wordCount.toLocaleString()}w)
                                              </option>
                                            ))}
                                          </select>
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              disabled={rewritingSectionId !== null}
                                              onClick={() => triggerSectionRewrite(draft.id, draftSectionNum[draft.id] ?? draftSections[draft.id][0]?.number ?? 0)}
                                              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
                                              data-testid={`button-rewrite-section-confirm-${draft.id}`}
                                            >
                                              {rewritingSectionId === draft.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                                              Rewrite
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setOpenSectionPicker(null)} className="text-gray-400 text-xs">
                                              Cancel
                                            </Button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteMutation.mutate(draft.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                data-testid={`button-delete-draft-${draft.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {publishedDrafts.length > 0 && (
                    <div ref={publishedSectionRef} className="border-t-2 border-green-500/30">
                      <button
                        onClick={() => setPublishedExpanded(!publishedExpanded)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors bg-green-500/5"
                        data-testid="button-toggle-published"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          <span className="text-sm font-display text-green-400">Published Books</span>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                            {publishedDrafts.length}
                          </Badge>
                          {publishedDrafts.filter(d => d.needsProdPush).length > 0 && (
                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                              {publishedDrafts.filter(d => d.needsProdPush).length} need prod push
                            </Badge>
                          )}
                          {publishedDrafts.filter(d => d.qualityDeferral).length > 0 && (
                            <Badge
                              className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs"
                              title="Structural issues noted for later (usually missing illustrations). Still published — considered good for now."
                            >
                              {publishedDrafts.filter(d => d.qualityDeferral).length} fix later
                            </Badge>
                          )}
                        </div>
                        <ChevronDown className={`h-5 w-5 text-green-400 transition-transform duration-200 ${publishedExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {publishedExpanded && (
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10 hover:bg-transparent">
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={allPublishedSelected}
                                  onCheckedChange={toggleSelectAllPublished}
                                  disabled={publishedSelectable.length === 0}
                                  data-testid="checkbox-select-all-published"
                                />
                              </TableHead>
                              <TableHead className="w-10 text-primary font-display">I.D. #</TableHead>
                              <TableHead className="text-primary font-display">Cover</TableHead>
                              <TableHead className="text-primary font-display">Title</TableHead>
                              <TableHead className="text-primary font-display">Genre</TableHead>
                              <TableHead className="text-primary font-display">Price</TableHead>
                              <TableHead className="text-primary font-display">Content</TableHead>
                              <TableHead className="text-primary font-display">Status</TableHead>
                              <TableHead className="text-right text-primary font-display">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {publishedDrafts.map((draft, index) => (
                              <TableRow key={draft.id} className="border-white/10 hover:bg-white/5 cursor-pointer" onDoubleClick={() => openEditDialog(draft)} data-testid={`row-draft-${draft.id}`}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.has(draft.id)}
                                    onCheckedChange={() => toggleSelection(draft.id)}
                                    disabled={!isDraftSelectable(draft)}
                                    data-testid={`checkbox-draft-${draft.id}`}
                                  />
                                </TableCell>
                          <DraftIdCell
                            draftId={draft.id}
                            queueStar={contentGenRunning && contentGenProgress.nextId === draft.id}
                          />
                                <TableCell>
                                  <DraftCoverThumb
                                    coverUrl={draft.coverUrl}
                                    backgroundUrl={draft.backgroundUrl}
                                    alt={draft.title}
                                    className="w-12 h-16 object-cover rounded"
                                  />
                                </TableCell>
                                <TableCell className="font-serif max-w-[200px] truncate">
                                  <span className="flex items-center gap-1">
                                    {draft.title}
                                    {exemptSet.has(draft.id) && (
                                      <span title="Illustration-exempt — images skipped to save costs" className="inline-flex items-center ml-1">
                                        <ImageOff className="h-3.5 w-3.5 text-red-400" />
                                      </span>
                                    )}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="border-white/20">{draft.genre}</Badge>
                                </TableCell>
                                <TableCell className="font-mono">${draft.suggestedPrice || "—"}</TableCell>
                                <TableCell>
                                  {(draft.contentWordCount || 0) > 0 ? (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      {(draft.contentWordCount || 0).toLocaleString()} words
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                      <Clock className="h-3 w-3 mr-1" />
                                      No content
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {getStatusBadge(draft.status)}
                                    {draft.needsProdPush && (
                                      <Badge
                                        className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]"
                                        title={
                                          draft.prodSyncReason === "local_changes"
                                            ? "Local content or cover changed since last production push"
                                            : "Never pushed to live production"
                                        }
                                      >
                                        {draft.prodSyncReason === "local_changes" ? "Prod: changed" : "Prod: new"}
                                      </Badge>
                                    )}
                                    {draft.qualityDeferral && (
                                      <Badge
                                        className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]"
                                        title={draft.qualityDeferralNote || "Fix later — still published / considered good"}
                                      >
                                        Fix later
                                      </Badge>
                                    )}
                                    {!(draft.inCatalog ?? draft.publishedBookId != null) && (
                                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]" title="Marked published in AI Studio but not in the storefront catalog">
                                        Not in catalog
                                      </Badge>
                                    )}
                                    {illustrationNeeds.some(n => n.id === draft.id) && (
                                      <>
                                        {(() => {
                                          const need = illustrationNeeds.find(n => n.id === draft.id);
                                          return (
                                            <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            fetch("/api/content-studio/illustrations-only", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
                                              body: JSON.stringify({ draftIds: [draft.id] }),
                                            }).then(r => { if (r.ok) { setIllustrationGenRunning(true); pollIllustrationProgress(); } else { r.json().then(d => alert(d.error || "Failed")); } }).catch(() => alert("Network error"));
                                          }}
                                          disabled={illustrationGenRunning}
                                          className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-[10px] px-1.5 h-6"
                                          data-testid={`button-art-only-pub-${draft.id}`}
                                          title={need?.reason || "Add art only — content stays the same"}
                                        >
                                          <ImageIcon className="h-3 w-3 mr-0.5" /> Art Only
                                        </Button>
                                        {need?.actionType === "rewrite-and-illustrate" && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            fetch("/api/content-studio/rewrite-specific-drafts", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
                                              body: JSON.stringify({ draftIds: [draft.id] }),
                                            }).then(r => { if (r.ok) { setContentGenRunning(true); pollContentGenStatus(); } else { r.json().then(d => alert(d.error || "Failed")); } }).catch(() => alert("Network error"));
                                          }}
                                          disabled={illustrationGenRunning || contentGenRunning}
                                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 text-[10px] px-1.5 h-6"
                                          data-testid={`button-rewrite-art-pub-${draft.id}`}
                                          title="Rewrite content + add art — for books written like novels"
                                        >
                                          <RefreshCw className="h-3 w-3 mr-0.5" /> Rewrite + Art
                                        </Button>
                                        )}
                                            </>
                                          );
                                        })()}
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    {(draft.coverUrl || draft.backgroundUrl) && (
                                      <Button size="sm" variant="ghost" onClick={() => handleDownloadCover(draft.id)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" data-testid={`button-download-${draft.id}`} title="Download Cover">
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(draft)} className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10" data-testid={`button-edit-${draft.id}`} title="Edit Title & Price">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setReviewDraft(draft);
                                        setReviewFullContent(null);
                                        setReviewFullOutline(null);
                                        setIsReviewOpen(true);
                                        fetch(`/api/content-studio/drafts/${draft.id}`, {
                                          headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" }
                                        }).then(r => r.json()).then(data => {
                                          setReviewFullContent(data.content || null);
                                          setReviewFullOutline(data.outline || null);
                                        }).catch(() => {});
                                      }}
                                      className="border-white/20 hover:bg-white/10"
                                      data-testid={`button-review-${draft.id}`}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Review
                                    </Button>
                                    {(draft.contentWordCount || 0) > 50 && (
                                      <a href={`/read/${draft.id}`} target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" variant="outline" className="border-amber-500/30 hover:bg-amber-900/30 text-amber-300" data-testid={`button-read-${draft.id}`} title="Read this book">
                                          <BookOpen className="h-4 w-4 mr-1" />
                                          Read
                                        </Button>
                                      </a>
                                    )}
                                    {(draft.contentWordCount || 0) >= 500 && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openRewriteConfirm(draft)}
                                        disabled={rewritingDraftIds.has(draft.id)}
                                        className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                        data-testid={`button-rewrite-content-${draft.id}`}
                                        title="Rewrite — moves book to unpublished for editing"
                                      >
                                        {rewritingDraftIds.has(draft.id) ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                                        Rewrite
                                      </Button>
                                    )}
                                    {(() => {
                                      const inCatalog = draft.inCatalog ?? draft.publishedBookId != null;
                                      const isVisible = bookVisibilityOverrides.has(draft.id) ? bookVisibilityOverrides.get(draft.id)! : (draft.bookVisible !== false);
                                      return (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => toggleBookVisibility(draft)}
                                          disabled={togglingVisibility.has(draft.id)}
                                          className={inCatalog
                                            ? (isVisible ? "border-red-500/50 text-red-400 hover:bg-red-500/10" : "border-green-500/50 text-green-400 hover:bg-green-500/10")
                                            : "border-amber-500/50 text-amber-400 hover:bg-amber-500/10"}
                                          data-testid={`button-visibility-${draft.id}`}
                                          title={inCatalog
                                            ? (isVisible ? "Hide from storefront" : "Restore to storefront")
                                            : "Published in AI Studio only — add to the storefront catalog"}
                                        >
                                          {togglingVisibility.has(draft.id) ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : inCatalog ? (isVisible ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />) : <Upload className="h-4 w-4 mr-1" />}
                                          {inCatalog ? (isVisible ? "Unpublish" : "Republish") : "Publish to Storefront"}
                                        </Button>
                                      );
                                    })()}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card className="bg-card/50 border-white/10">
              <CardContent className="p-0">
                {jobsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-serif">No generation jobs yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-primary font-display">Genre</TableHead>
                        <TableHead className="text-primary font-display">Progress</TableHead>
                        <TableHead className="text-primary font-display">Status</TableHead>
                        <TableHead className="text-primary font-display">Started</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id} className="border-white/10 hover:bg-white/5" data-testid={`row-job-${job.id}`}>
                          <TableCell className="font-serif">{job.genre}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Progress 
                                value={(job.completedItems / (job.totalItems || 1)) * 100} 
                                className="w-24 h-2"
                              />
                              <span className="text-sm text-muted-foreground">
                                {job.completedItems}/{job.totalItems}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(job.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cover Preview Tab */}
          <TabsContent value="cover-preview">
            <Card className="bg-card/50 border-white/10">
              <CardHeader className="pb-4">
                <div className="flex flex-row items-center justify-between">
                  <CardTitle className="font-display text-lg text-primary">
                    Cover Preview & Styling
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {draftsWithBg && (
                      <span>
                        Page {draftsWithBg.pagination.page} of {draftsWithBg.pagination.totalPages} 
                        ({draftsWithBg.pagination.total} total)
                      </span>
                    )}
                  </div>
                </div>
                <CardDescription className="font-serif">
                  Customize your cover typography with 20+ professional fonts and artistic text effects. Preview your changes before finalizing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {draftsWithBgLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : !draftsWithBg || draftsWithBg.drafts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-serif">No drafts with backgrounds available for preview</p>
                    <p className="text-sm mt-2">Regenerate covers first to save background images</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {draftsWithBg.drafts.map((draft) => {
                        // Initialize options for this draft
                        if (!previewOptions[draft.id]) {
                          initOptions(draft.id);
                        }
                        const opts = previewOptions[draft.id] || {
                          titleFont: "Great Vibes",
                          authorFont: "Playfair Display",
                          titleCase: "titlecase" as const,
                          effect: "outline",
                          position: "top-center",
                        };
                        const isLoading = loadingPreviews.has(draft.id);
                        const previewImage = previewImages[draft.id];

                        return (
                          <div key={draft.id} className="border border-white/10 rounded-lg p-4 bg-white/5 space-y-3" data-testid={`preview-card-${draft.id}`}>
                            {/* Cover Image */}
                            <div className="relative aspect-[3/4] bg-black/20 rounded overflow-hidden">
                              <img
                                src={previewImage || draft.coverUrl || ""}
                                alt={draft.title}
                                className="w-full h-full object-cover"
                              />
                              {isLoading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                                </div>
                              )}
                              {previewImage && (
                                <Badge className="absolute top-2 right-2 bg-green-600">Preview</Badge>
                              )}
                            </div>
                            
                            {/* Title */}
                            <p className="font-serif text-sm truncate" title={draft.title}>{draft.title}</p>
                            
                            {/* Options */}
                            <div className="space-y-2">
                              {/* Title Font */}
                              <div className="flex gap-2 items-center">
                                <Label className="text-xs w-16 text-muted-foreground">Title:</Label>
                                <Select
                                  value={opts.titleFont}
                                  onValueChange={(v) => updateOption(draft.id, "titleFont", v)}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fontOptions?.titleFonts.map((font) => (
                                      <SelectItem key={font} value={font}>{font}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Author Font */}
                              <div className="flex gap-2 items-center">
                                <Label className="text-xs w-16 text-muted-foreground">Author:</Label>
                                <Select
                                  value={opts.authorFont}
                                  onValueChange={(v) => updateOption(draft.id, "authorFont", v)}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fontOptions?.authorFonts.map((font) => (
                                      <SelectItem key={font} value={font}>{font}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Effect */}
                              <div className="flex gap-2 items-center">
                                <Label className="text-xs w-16 text-muted-foreground">Effect:</Label>
                                <Select
                                  value={opts.effect}
                                  onValueChange={(v) => updateOption(draft.id, "effect", v)}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue placeholder="Select effect" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fontOptions?.effects.map((effect) => (
                                      <SelectItem key={effect} value={effect}>{formatEffectName(effect)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Position */}
                              <div className="flex gap-2 items-center">
                                <Label className="text-xs w-16 text-muted-foreground">Position:</Label>
                                <Select
                                  value={opts.position}
                                  onValueChange={(v) => updateOption(draft.id, "position", v)}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue placeholder="Select position" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fontOptions?.positions.map((pos) => (
                                      <SelectItem key={pos} value={pos}>{formatPositionName(pos)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Case */}
                              <div className="flex gap-2 items-center">
                                <Label className="text-xs w-16 text-muted-foreground">Case:</Label>
                                <Select
                                  value={opts.titleCase}
                                  onValueChange={(v) => updateOption(draft.id, "titleCase", v as "uppercase" | "titlecase" | "original")}
                                >
                                  <SelectTrigger className="h-7 text-xs flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {fontOptions?.titleCases.map((tc) => (
                                      <SelectItem key={tc} value={tc}>{tc}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generatePreview(draft.id, opts)}
                                disabled={isLoading}
                                className="flex-1 h-8 text-xs"
                                data-testid={`button-preview-${draft.id}`}
                              >
                                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
                                Preview
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => finalizeCover(draft.id, opts)}
                                disabled={isLoading}
                                className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                                data-testid={`button-finalize-${draft.id}`}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Finalize
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {draftsWithBg.pagination.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-4 mt-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                          disabled={previewPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {previewPage} of {draftsWithBg.pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewPage(p => Math.min(draftsWithBg.pagination.totalPages, p + 1))}
                          disabled={previewPage === draftsWithBg.pagination.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary flex items-center gap-2">
              <Eye className="h-6 w-6" />
              Review Ebook
            </DialogTitle>
          </DialogHeader>
          
          {reviewDraft && (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Cover and Info */}
              <div className="space-y-4">
                {reviewDraft.coverUrl ? (
                  <img 
                    src={reviewDraft.coverUrl} 
                    alt={reviewDraft.title}
                    className="w-full aspect-[3/4] object-cover rounded-lg border border-white/10"
                    data-testid="review-cover-image"
                  />
                ) : (
                  <div className="w-full aspect-[3/4] bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                    <BookOpen className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Genre</span>
                    <Badge variant="outline" className="border-white/20">{reviewDraft.genre}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-mono text-primary">${reviewDraft.suggestedPrice || "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    {getStatusBadge(reviewDraft.status)}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(reviewDraft.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              {/* Content Preview */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h3 className="font-display text-xl mb-2">{reviewDraft.title}</h3>
                  <p className="text-sm text-muted-foreground font-serif">Topic: {reviewDraft.topic}</p>
                </div>
                
                {(reviewDraft.contentWordCount || 0) > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {(reviewDraft.contentWordCount || 0).toLocaleString()} words
                    </Badge>
                  </div>
                )}
                <ScrollArea className="h-[400px] rounded-lg border border-white/10 bg-black/20 p-4" data-testid="review-content-scroll">
                  {reviewFullContent ? (
                    <div className="prose prose-invert prose-sm max-w-none font-serif whitespace-pre-wrap">
                      {reviewFullContent}
                    </div>
                  ) : reviewFullOutline ? (
                    <div className="prose prose-invert prose-sm max-w-none font-serif whitespace-pre-wrap">
                      <p className="text-amber-400 mb-2">Content still generating... Here's the outline:</p>
                      {reviewFullOutline}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                        <p className="font-serif">Content is being generated...</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            {reviewDraft?.coverUrl && (
              <Button
                variant="outline"
                onClick={() => handleDownloadCover(reviewDraft.id)}
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                data-testid="button-download-from-review"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Cover
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (reviewDraft) {
                  openEditDialog(reviewDraft);
                  setIsReviewOpen(false);
                }
              }}
              className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              data-testid="button-edit-from-review"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit Details
            </Button>
            {reviewDraft && reviewDraft.status === "generating" && (
              <Button
                variant="outline"
                onClick={() => {
                  resetAndRestart(reviewDraft.id);
                  setIsReviewOpen(false);
                }}
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                data-testid="button-reset-stuck-from-review"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Stuck
              </Button>
            )}
            {reviewDraft && (reviewDraft as any).needsContinuation && reviewDraft.status !== "generating" && (
              <Button
                variant="outline"
                onClick={() => {
                  continueWriting(reviewDraft.id);
                  setIsReviewOpen(false);
                }}
                disabled={continuingDraftIds.has(reviewDraft?.id ?? -1)}
                className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                data-testid="button-continue-from-review"
              >
                <Play className="h-4 w-4 mr-2" />
                Continue ({(reviewDraft as any).writtenChapterCount}/{(reviewDraft as any).outlineChapterCount || '?'})
              </Button>
            )}
            {reviewDraft && (
              <Button
                variant="outline"
                onClick={() => {
                  setIsReviewOpen(false);
                  openRewriteConfirm(reviewDraft);
                }}
                disabled={rewritingDraftIds.has(reviewDraft?.id ?? -1)}
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                data-testid="button-rewrite-from-review"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {reviewDraft.content && reviewDraft.content.trim().length > 0 ? "Rewrite Content" : "Write Content"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsReviewOpen(false)}
              className="border-white/20"
            >
              Close
            </Button>
            {reviewDraft && (reviewDraft.status === "ready" || (reviewDraft.status === "draft" && reviewDraft.content && reviewDraft.content.trim().length > 100)) && (
              <Button
                onClick={() => {
                  publishMutation.mutate(reviewDraft.id);
                  setIsReviewOpen(false);
                }}
                disabled={publishMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-publish-from-review"
              >
                <Upload className="h-4 w-4 mr-2" />
                Publish This Ebook
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => {
                if (reviewDraft) {
                  deleteMutation.mutate(reviewDraft.id);
                  setIsReviewOpen(false);
                }
              }}
              data-testid="button-delete-from-review"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ProWriting Metrics Modal */}
      <Dialog open={!!metricsModal} onOpenChange={(open) => { if (!open) { setMetricsModal(null); setMetricsData(null); } }}>
        <DialogContent className="max-w-lg bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-blue-400 flex items-center gap-2">
              <BarChart2 className="h-5 w-5" />
              Writing Quality Report
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm truncate">{metricsModal?.title}</DialogDescription>
          </DialogHeader>
          {metricsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>
          ) : metricsData?.error ? (
            <p className="text-red-400 text-sm py-4">{metricsData.error}</p>
          ) : metricsData ? (
            <div className="space-y-4">
              {/* Overall score */}
              <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <span className="font-semibold text-white">Overall Score</span>
                <span className={`text-2xl font-bold ${(metricsData.overallScore ?? 0) >= 7 ? "text-emerald-400" : (metricsData.overallScore ?? 0) >= 5 ? "text-amber-400" : "text-red-400"}`}>
                  {metricsData.overallScore ?? "—"}/10
                </span>
              </div>
              {/* Metric grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Passive Voice", value: `${metricsData.passiveVoicePct ?? 0}%`, good: (metricsData.passiveVoicePct ?? 0) <= 3.5, target: "target < 3%" },
                  { label: "Adverb Density", value: `${metricsData.adverbPct ?? 0}%`, good: (metricsData.adverbPct ?? 0) <= 1.8, target: "target < 1.5%" },
                  { label: "AI-Tell Score", value: `${metricsData.aiTellScore ?? 0}/10`, good: (metricsData.aiTellScore ?? 0) >= 7, target: `${metricsData.aiTellCount ?? 0} phrases found` },
                  { label: "Opening Hook", value: `${metricsData.openingHookScore ?? 0}/10`, good: (metricsData.openingHookScore ?? 0) >= 7, target: "grip from page 1" },
                ].map(m => (
                  <div key={m.label} className={`rounded-lg p-3 border ${m.good ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                      {m.good ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                    </div>
                    <p className={`text-lg font-bold ${m.good ? "text-emerald-400" : "text-amber-400"}`}>{m.value}</p>
                    <p className="text-[10px] text-muted-foreground">{m.target}</p>
                  </div>
                ))}
              </div>
              {/* Pacing */}
              {metricsData.pacingReport && metricsData.pacingReport !== "Pacing analysis unavailable" && (
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs font-semibold text-white mb-1">Pacing</p>
                  <p className="text-xs text-muted-foreground">{metricsData.pacingReport}</p>
                </div>
              )}
              {/* Issues */}
              {metricsData.issues?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-400">Issues to Address</p>
                  {metricsData.issues.map((iss: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />{iss}
                    </div>
                  ))}
                </div>
              )}
              {metricsData.issues?.length === 0 && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <ShieldCheck className="h-4 w-4" /> All metrics within target — prose quality is strong.
                </div>
              )}
              {metricsData.cached && <p className="text-[10px] text-muted-foreground text-center">Cached from last generation · {new Date(metricsData.generatedAt).toLocaleDateString()}</p>}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!rewriteConfirmDraft} onOpenChange={(open) => { if (!open) setRewriteConfirmDraft(null); }}>
        <DialogContent className="max-w-md bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-amber-400 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {rewriteConfirmDraft?.content && rewriteConfirmDraft.content.trim().length > 0 ? "Rewrite Content" : "Write Content"}
            </DialogTitle>
            <DialogDescription>
              {rewriteConfirmDraft?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Genre(s)</Label>
              <Input
                value={rewriteGenre}
                onChange={(e) => setRewriteGenre(e.target.value)}
                placeholder="e.g. Drama, Drama / Romance, Horror / Thriller"
                className="bg-white/5 border-white/20"
                data-testid="input-rewrite-genre"
              />
              <p className="text-xs text-muted-foreground">
                Type one genre or combine with " / " for multi-genre (e.g. "Drama / Romance")
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">AI Provider:</span>
              <div 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                  aiProvider === "replit" 
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-300" 
                    : "bg-secondary/50 border-border text-muted-foreground"
                }`}
              >
                <span className="text-xs font-medium">OpenAI</span>
                <Switch 
                  checked={aiProvider === "replit"}
                  onCheckedChange={toggleAIProvider}
                  className="data-[state=checked]:bg-blue-500"
                />
                <span className="text-xs font-medium">Replit AI</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRewriteConfirmDraft(null)} className="border-white/20">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (rewriteConfirmDraft) {
                  const genreChanged = rewriteGenre.trim() !== (rewriteConfirmDraft.genre || "");
                  startRewrite(rewriteConfirmDraft.id, genreChanged ? rewriteGenre.trim() : undefined);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="button-confirm-rewrite"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Start {rewriteConfirmDraft?.content && rewriteConfirmDraft.content.trim().length > 0 ? "Rewrite" : "Writing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Ebook Details
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update the title and price for this ebook. You can download the cover and add your own text using photo editing software.
            </DialogDescription>
          </DialogHeader>
          
          {editingDraft && (
            <div className="space-y-4 py-4">
              {editingDraft.coverUrl && (
                <div className="flex justify-center">
                  <img 
                    src={editingDraft.coverUrl} 
                    alt={editingDraft.title}
                    className="w-32 h-44 object-cover rounded-lg border border-white/10"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter ebook title"
                  className="bg-white/5 border-white/20"
                  data-testid="input-edit-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-genre">Genre <span className="text-xs text-gray-400">(combine with " / " for multi-genre, e.g. "Drama / Romance")</span></Label>
                <Input
                  id="edit-genre"
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  placeholder="e.g. Drama / Self-Help"
                  className="bg-white/5 border-white/20"
                  data-testid="input-edit-genre"
                />
              </div>

              <Button
                variant="outline"
                disabled={regeneratingTitle}
                onClick={async () => {
                  if (!editingDraft) return;
                  setRegeneratingTitle(true);
                  try {
                    const res = await fetch(`/api/content-studio/regenerate-title/${editingDraft.id}`, { method: "POST" });
                    if (!res.ok) throw new Error("Failed");
                    const data = await res.json();
                    setEditTitle(data.title);
                    toast({ title: "New Title Generated", description: data.title });
                    queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
                  } catch {
                    toast({ title: "Error", description: "Failed to regenerate title", variant: "destructive" });
                  } finally {
                    setRegeneratingTitle(false);
                  }
                }}
                className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/10 py-5 text-base"
                data-testid="button-regenerate-title"
              >
                {regeneratingTitle ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Generating New Title...</> : <><RefreshCw className="h-5 w-5 mr-2" /> Generate New Title from Description</>}
              </Button>
              
              <div className="space-y-2">
                <Label htmlFor="edit-price">Price ($)</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="9.99"
                  className="bg-white/5 border-white/20"
                  data-testid="input-edit-price"
                />
              </div>

              {sectionList.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-white/10">
                  <Label className="text-amber-300 font-display text-sm">Rewrite Section</Label>
                  <div className="flex items-center gap-3">
                    <select
                      value={rewriteSectionNum}
                      onChange={(e) => setRewriteSectionNum(parseInt(e.target.value))}
                      className="flex-1 bg-stone-800 border border-white/20 rounded-md px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                      data-testid="select-rewrite-section"
                    >
                      {sectionList.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.number === 0 ? "About this Book" : `Chapter ${s.number}`} — {s.title.length > 40 ? s.title.substring(0, 40) + "..." : s.title} ({s.wordCount.toLocaleString()} words)
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={rewritingSectionId !== null}
                      onClick={async () => {
                        if (!editingDraft) return;
                        setRewritingSectionId(editingDraft.id);
                        try {
                          const res = await fetch(`/api/content-studio/rewrite-section/${editingDraft.id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
                            body: JSON.stringify({ sectionNumber: rewriteSectionNum }),
                          });
                          if (!res.ok) throw new Error((await res.json()).error || "Failed");
                          toast({ title: "Rewriting Started", description: `${rewriteSectionNum === 0 ? "About this Book" : `Chapter ${rewriteSectionNum}`} is being rewritten. This may take a minute.` });
                          queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
                        } catch (err: any) {
                          toast({ title: "Error", description: err.message || "Failed to start rewrite", variant: "destructive" });
                        } finally {
                          setRewritingSectionId(null);
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-500 text-white whitespace-nowrap"
                      data-testid="button-rewrite-section"
                    >
                      {rewritingSectionId !== null ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Rewriting...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-1" /> Rewrite</>
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-500">Select a section and click Rewrite. The AI will rewrite just that section while keeping continuity with the rest of the book.</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            {editingDraft?.coverUrl && (
              <Button
                variant="outline"
                onClick={() => handleDownloadCover(editingDraft.id)}
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                data-testid="button-download-from-edit"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Cover
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              className="border-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingDraft) {
                  updateDraftMutation.mutate({
                    draftId: editingDraft.id,
                    title: editTitle,
                    price: editPrice,
                    genre: editGenre || undefined,
                  });
                }
              }}
              disabled={updateDraftMutation.isPending}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-save-edit"
            >
              {updateDraftMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-lg bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Upload {uploadType === "covers" ? "Covers" : "PDFs"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {uploadType === "covers" 
                ? "Upload a ZIP file containing cover images. Files should be named 'cover-{id}.png' (e.g., cover-15.png). A manifest.json file in the ZIP will also be used if present."
                : "Upload a ZIP file containing PDF files. Files should be named 'ebook-{id}.pdf' (e.g., ebook-15.pdf)."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".zip"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const formData = new FormData();
                  formData.append("file", file);
                  
                  try {
                    const endpoint = uploadType === "covers" 
                      ? "/api/content-studio/upload-covers-zip"
                      : "/api/content-studio/upload-pdfs-zip";
                    
                    const response = await fetch(endpoint, {
                      method: "POST",
                      body: formData,
                    });
                    
                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || "Upload failed");
                    }
                    
                    const result = await response.json();
                    toast({ 
                      title: "Upload Complete", 
                      description: `Successfully updated ${result.updated} ${uploadType}` 
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
                    setIsUploadOpen(false);
                  } catch (error) {
                    toast({ 
                      title: "Upload Failed", 
                      description: error instanceof Error ? error.message : "Unknown error", 
                      variant: "destructive" 
                    });
                  }
                }}
                className="hidden"
                id="upload-zip"
                data-testid="input-upload-zip"
              />
              <label htmlFor="upload-zip" className="cursor-pointer">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-serif text-lg mb-2">Click to select ZIP file</p>
                <p className="text-sm text-muted-foreground">
                  {uploadType === "covers" 
                    ? "Expecting cover-{id}.png files" 
                    : "Expecting ebook-{id}.pdf files"}
                </p>
              </label>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUploadOpen(false)}
              className="border-white/20"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cover Style Selector Dialog */}
      <Dialog open={isStyleSelectorOpen} onOpenChange={setIsStyleSelectorOpen}>
        <DialogContent className="max-w-4xl bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Select Cover Style
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose a style preset for regenerating the cover. The "Classic Cinematic" style is our premium default.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
              {coverStyles?.styles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyleId(style.id)}
                  className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                    selectedStyleId === style.id
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-white/10 hover:border-white/30 bg-white/5"
                  }`}
                  data-testid={`style-button-${style.id}`}
                >
                  {style.isPrimary && (
                    <Badge className="absolute -top-2 -right-2 bg-amber-500 text-black text-xs px-1.5">
                      Default
                    </Badge>
                  )}
                  <div className="w-full aspect-[3/4] rounded-lg mb-2 flex items-center justify-center overflow-hidden" 
                       style={{
                         background: style.id === "classic-cinematic" 
                           ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
                           : style.id === "dark-academia"
                           ? "linear-gradient(135deg, #3d2c29 0%, #5c4a47 50%, #8b7355 100%)"
                           : style.id === "modern-minimal"
                           ? "linear-gradient(135deg, #2d3436 0%, #636e72 50%, #b2bec3 100%)"
                           : style.id === "romantic-elegant"
                           ? "linear-gradient(135deg, #f8b4b4 0%, #f5d0c5 50%, #ffe4e1 100%)"
                           : style.id === "cyberpunk-neon"
                           ? "linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 50%, #2d0a4e 100%)"
                           : style.id === "vintage-retro"
                           ? "linear-gradient(135deg, #d4a574 0%, #c4956a 50%, #b38b6d 100%)"
                           : style.id === "mystical-celestial"
                           ? "linear-gradient(135deg, #1a0033 0%, #2d1b69 50%, #11001c 100%)"
                           : "linear-gradient(135deg, #2d5016 0%, #4a7c23 50%, #6fa32f 100%)"
                       }}>
                    <div className="text-center p-2">
                      <div className="text-white/90 text-sm font-bold" 
                           style={{ 
                             fontFamily: style.titleFont === "Great Vibes" || style.titleFont === "Dancing Script" || style.titleFont === "Sacramento"
                               ? "cursive" 
                               : style.titleFont === "Oswald" || style.titleFont === "Montserrat"
                               ? "sans-serif"
                               : "serif"
                           }}>
                        Sample
                      </div>
                      <div className="text-white/60 text-xs">Title</div>
                    </div>
                  </div>
                  <h4 className="font-serif font-semibold text-sm text-white mb-1">{style.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{style.description}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsStyleSelectorOpen(false)}
              className="border-white/20"
            >
              Cancel
            </Button>
            <Button
              onClick={regenerateCoverWithStyle}
              disabled={regeneratingWithStyle}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-regenerate-with-style"
            >
              {regeneratingWithStyle ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate with {coverStyles?.styles.find(s => s.id === selectedStyleId)?.name || "Style"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-primary flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import from Catalog
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Import published books from your storefront catalog into Content Studio. Once imported, you can write or rewrite their content using the AI Story Architect.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-96 overflow-y-auto">
            {importableBooks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">All catalog books are already in Content Studio.</p>
            ) : (
              importableBooks.map((book: any) => (
                <div key={book.id} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5" data-testid={`import-book-${book.id}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {book.coverUrl && (
                      <img src={book.coverUrl} alt="" className="w-10 h-14 object-cover rounded" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.genre} {book.price ? `· $${book.price}` : ''}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => importBook(book.id)}
                    disabled={importingBookId === book.id}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white ml-2 shrink-0"
                    data-testid={`button-import-${book.id}`}
                  >
                    {importingBookId === book.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Import"
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)} className="border-white/20">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
