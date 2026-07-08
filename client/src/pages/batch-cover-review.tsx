import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, CheckCircle, Image, Type, ArrowLeft, Eye, Palette, Check, Square, CheckSquare, Home, BookOpen, Download, Upload, Sparkles, ChevronLeft, ChevronRight, ChevronDown, Trash2, Replace, Wand2, ArrowRight, Search, X, Maximize2, Minimize2, Lightbulb, Users, TrendingUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getEffectClass, getColorVariables } from "@/lib/typography-effects";
import { analyzeForTypography, enhanceTypographyOptions, getComplexityBreakdown, type VisualIntelligenceResult } from "@/lib/visual-intelligence";
import { titlePerfectionEngine, type PerfectTitleDesign } from "@/lib/title-perfection-engine";
import "@/styles/visual-title-enhancement.css";

interface DraftEbook {
  id: number;
  title: string;
  genre: string;
  topic: string;
  coverUrl: string | null;
  backgroundUrl: string | null;
  status: string;
  coverStyleId: string | null;
  overlayApproved: boolean;
  publishedAt: string | null;
}

interface ColorPreset {
  name: string;
  titleColor: string;
  authorColor: string;
  outlineColor: string;
}

interface FontOptions {
  titleFonts: string[];
  authorFonts: string[];
  effects: string[];
  positions: string[];
  titleCases: string[];
  colorPresets: ColorPreset[];
}

interface AIModelStyle {
  id: string;
  name: string;
  description: string;
  model: string;
  previewImage: string;
  characteristics: string[];
}

interface AIModelStylesResponse {
  styles: AIModelStyle[];
  defaultStyleId: string;
}

interface BookRequestRow {
  id: number;
  customerEmail: string | null;
  requestText: string;
  suggestedTitle: string | null;
  suggestedGenre: string | null;
  status: string;
  createdAt: string;
}

interface ResearchTitlesResult {
  ideas: Array<{
    title: string;
    genre: string;
    topic: string;
    source: string;
    rationale: string;
  }>;
  createdDraftIds: number[];
  usedRequestIds: number[];
  skippedDuplicates: number;
  message: string;
}

// AI Cover Analysis Result
interface CoverAnalysisResult {
  hasExistingText: boolean;
  detectedTitle: string | null;
  detectedAuthor: string | null;
  existingTextAreas: Array<{ position: string; content: string }>;
  dominantColors: string[];
  suggestedTypography: {
    titleFont: string;
    authorFont: string;
    titleColor: string;
    authorColor: string;
    titlePosition: "top" | "center" | "bottom";
    titleAlignment?: "left" | "center" | "right";
    authorPosition: "top" | "center" | "bottom";
    authorAlignment?: "left" | "center" | "right";
    effect: string;
    reasoning: string;
  };
  needsTitle: boolean;
  needsAuthor: boolean;
}

const formatEffectName = (effect: string) => {
  return effect.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

const formatPositionName = (position: string) => {
  return position.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

/** Local dev serves /uploads/covers; production uses /objstore/covers. */
function normalizeLocalCoverUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.replace(/^\/objstore\/covers\//, "/uploads/covers/");
}

function coverReviewHasImage(draft: Pick<DraftEbook, "coverUrl" | "backgroundUrl">): boolean {
  return !!(draft.coverUrl || draft.backgroundUrl);
}

/** Research / idea placers: title + genre only — no AI style or cover yet. */
function isTitlePlacerDraft(draft: Pick<DraftEbook, "coverUrl" | "backgroundUrl" | "coverStyleId">): boolean {
  return !draft.coverStyleId && !coverReviewHasImage(draft);
}

function coverReviewPrimaryUrl(
  draft: Pick<DraftEbook, "coverUrl" | "backgroundUrl">,
  showCleanBackgrounds: boolean,
): string {
  if (showCleanBackgrounds) {
    return normalizeLocalCoverUrl(draft.backgroundUrl || draft.coverUrl);
  }
  return normalizeLocalCoverUrl(draft.coverUrl || draft.backgroundUrl);
}

function coverReviewFallbackUrl(
  draft: Pick<DraftEbook, "coverUrl" | "backgroundUrl">,
  showCleanBackgrounds: boolean,
): string {
  if (showCleanBackgrounds) {
    return normalizeLocalCoverUrl(draft.coverUrl);
  }
  return normalizeLocalCoverUrl(draft.backgroundUrl);
}

function CoverReviewImage({
  draft,
  showCleanBackgrounds,
  className,
  loading,
  "data-testid": dataTestId,
}: {
  draft: Pick<DraftEbook, "coverUrl" | "backgroundUrl" | "title">;
  showCleanBackgrounds: boolean;
  className?: string;
  loading?: "lazy" | "eager";
  "data-testid"?: string;
}) {
  const primary = coverReviewPrimaryUrl(draft, showCleanBackgrounds);
  const fallback = coverReviewFallbackUrl(draft, showCleanBackgrounds);
  const [src, setSrc] = useState(primary || fallback);

  useEffect(() => {
    setSrc(primary || fallback);
  }, [primary, fallback]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={draft.title}
      className={className}
      loading={loading}
      data-testid={dataTestId}
      onError={() => {
        if (fallback && src !== fallback) setSrc(fallback);
      }}
    />
  );
}

// Genre-based typography selection based on industry best practices
interface GenreTypography {
  titleFont: string;
  authorFont: string;
  titleSize: string;
  authorSize: string;
  position: "top" | "center" | "bottom";
  titleColor: string;
  authorColor: string;
  effect: string;
}

const getGenreTypography = (genre: string): GenreTypography => {
  const genreLower = genre.toLowerCase();
  
  // Romance - flowing scripts, elegant gold tones
  if (genreLower.includes("romance") || genreLower.includes("love")) {
    return {
      titleFont: "Great Vibes",
      authorFont: "Cormorant Garamond",
      titleSize: "text-xl",
      authorSize: "text-xs",
      position: "top",
      titleColor: "#FFE4C4",
      authorColor: "#E8D5B7",
      effect: "elegant"
    };
  }
  
  // Thriller/Mystery - sharp, dramatic
  if (genreLower.includes("thriller") || genreLower.includes("mystery") || genreLower.includes("suspense")) {
    return {
      titleFont: "Cinzel",
      authorFont: "Lato",
      titleSize: "text-xl",
      authorSize: "text-xs",
      position: "top",
      titleColor: "#E8E8E8",
      authorColor: "#B0B0B0",
      effect: "cinematic"
    };
  }
  
  // Fantasy - classical, ornate gold
  if (genreLower.includes("fantasy") || genreLower.includes("magic")) {
    return {
      titleFont: "Tangerine",
      authorFont: "Cormorant Garamond",
      titleSize: "text-2xl",
      authorSize: "text-xs",
      position: "top",
      titleColor: "#FFD700",
      authorColor: "#E8D5B7",
      effect: "gold-emboss"
    };
  }
  
  // Sci-Fi - futuristic, neon glow
  if (genreLower.includes("sci-fi") || genreLower.includes("science fiction") || genreLower.includes("dystopian")) {
    return {
      titleFont: "Rajdhani",
      authorFont: "Roboto",
      titleSize: "text-xl",
      authorSize: "text-xs",
      position: "top",
      titleColor: "#00D4FF",
      authorColor: "#A0D4E4",
      effect: "neon"
    };
  }
  
  // Horror - dark, dramatic red
  if (genreLower.includes("horror") || genreLower.includes("dark")) {
    return {
      titleFont: "Cinzel",
      authorFont: "Crimson Text",
      titleSize: "text-xl",
      authorSize: "text-xs",
      position: "top",
      titleColor: "#DC143C",
      authorColor: "#A0A0A0",
      effect: "bold-shadow"
    };
  }
  
  // Self-Help/Business - clean, professional
  if (genreLower.includes("self-help") || genreLower.includes("business") || genreLower.includes("productivity") || genreLower.includes("finance")) {
    return {
      titleFont: "Playfair Display",
      authorFont: "Open Sans",
      titleSize: "text-xl",
      authorSize: "text-xs",
      position: "top",
      titleColor: "#FFFFFF",
      authorColor: "#C0C0C0",
      effect: "elegant"
    };
  }
  
  // History/Biography - classic vintage
  if (genreLower.includes("history") || genreLower.includes("biography") || genreLower.includes("memoir")) {
    return {
      titleFont: "Cinzel",
      authorFont: "Source Serif Pro",
      titleSize: "text-xl",
      authorSize: "text-xs",
      position: "top",
      titleColor: "#F5DEB3",
      authorColor: "#D4C4B0",
      effect: "vintage"
    };
  }
  
  // Poetry - elegant script, flowing
  if (genreLower.includes("poetry") || genreLower.includes("poem")) {
    return {
      titleFont: "Allura",
      authorFont: "EB Garamond",
      titleSize: "text-2xl",
      authorSize: "text-xs",
      position: "top",
      titleColor: "#FFF8DC",
      authorColor: "#E8E8E8",
      effect: "elegant"
    };
  }
  
  // Adventure - bold, dynamic gold
  if (genreLower.includes("adventure") || genreLower.includes("action")) {
    return {
      titleFont: "Cinzel",
      authorFont: "Roboto Condensed",
      titleSize: "text-xl",
      authorSize: "text-xs",
      position: "top",
      titleColor: "#FFD700",
      authorColor: "#E8E8E8",
      effect: "bold-shadow"
    };
  }
  
  // Default - classic cinematic style (like covers 239-253)
  return {
    titleFont: "Great Vibes",
    authorFont: "Cormorant Garamond",
    titleSize: "text-xl",
    authorSize: "text-xs",
    position: "top",
    titleColor: "#FFF8DC",
    authorColor: "#E8D5B7",
    effect: "elegant"
  };
};

export default function BatchCoverReview() {
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("ebgz_admin_token");
  if (!hasToken) {
    window.location.href = "/";
    return null;
  }
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    async function verifyAndRefreshSession() {
      const token = localStorage.getItem("ebgz_admin_token") || "";
      await fetch("/api/admin/verify", {
        headers: { "x-admin-token": token },
      });
    }
    verifyAndRefreshSession();
  }, []);
  
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [coverFilter, setCoverFilter] = useState<"all" | "unpublished" | "published">("all");
  const [syncingCoverIds, setSyncingCoverIds] = useState<Set<number>>(new Set());
  const [coverFitOverrides, setCoverFitOverrides] = useState<Map<number, "cover" | "contain">>(new Map());

  // View mode: show clean backgrounds or covers with text (default: show covers with text/overlays)
  const [showCleanBackgrounds, setShowCleanBackgrounds] = useState(false);
  
  // Filter: show ebooks missing covers
  const [showMissingCovers, setShowMissingCovers] = useState(false);
  
  // Filter: hide classics by default (they belong in Author Library unless experimenting)
  const [showClassics, setShowClassics] = useState(false);
  
  // Reassign cover to coverless ebook
  const [reassignSourceId, setReassignSourceId] = useState<number | null>(null);
  const [reassignSearch, setReassignSearch] = useState("");

  // Duplicates popup
  const [showDuplicatesPopup, setShowDuplicatesPopup] = useState(false);
  const [chosenDuplicates, setChosenDuplicates] = useState<Map<string, number>>(new Map());
  const [deletingDuplicates, setDeletingDuplicates] = useState(false);
  const [aiMatchingId, setAiMatchingId] = useState<number | null>(null);
  const [aiMatches, setAiMatches] = useState<Map<number, { id: number; title: string; genre: string; confidence: string; reason: string }>>(new Map());
  const [aiTitleSuggestingId, setAiTitleSuggestingId] = useState<number | null>(null);
  const [aiTitleSuggestions, setAiTitleSuggestions] = useState<Map<number, { title: string; genre: string; reason: string }[]>>(new Map());
  const [applyingTitleId, setApplyingTitleId] = useState<number | null>(null);

  // AI market research → new title placers (cover-first workflow)
  const [showResearchDialog, setShowResearchDialog] = useState(false);
  const [showRequestPool, setShowRequestPool] = useState(false);
  const [researchCount, setResearchCount] = useState(8);
  const [researchFocusNotes, setResearchFocusNotes] = useState("");
  const [includeCustomerRequests, setIncludeCustomerRequests] = useState(true);
  const [lastResearchResult, setLastResearchResult] = useState<ResearchTitlesResult | null>(null);
  
  // Text preview mode: show title/author text overlay on covers
  const [showTextPreview, setShowTextPreview] = useState(false);
  const [textPreviewIds, setTextPreviewIds] = useState<Set<number>>(new Set());
  
  // Selected covers for multi-select (can select multiple)
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<number>>(new Set());
  
  // Single selected cover for preview (the last clicked one)
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  
  // Double-click cover preview modal
  const [previewDraft, setPreviewDraft] = useState<DraftEbook | null>(null);
  const [previewTitleMismatch, setPreviewTitleMismatch] = useState(false);
  const [previewEditTitle, setPreviewEditTitle] = useState("");
  const [previewSavingTitle, setPreviewSavingTitle] = useState(false);
  const [previewTitleSaved, setPreviewTitleSaved] = useState(false);
  const [previewGeneratingOverlay, setPreviewGeneratingOverlay] = useState(false);
  const [previewOverlayMode, setPreviewOverlayMode] = useState<"main-only" | "full-shrink" | null>(null);
  const [previewTitleSize, setPreviewTitleSize] = useState(100);
  const [previewTitleCutoff, setPreviewTitleCutoff] = useState<number | null>(null);
  const [previewRegeneratingTitle, setPreviewRegeneratingTitle] = useState(false);
  const [previewGeneratedTitles, setPreviewGeneratedTitles] = useState<string[]>([]);
  const previewAutoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const lastSavedDraftIdRef = useRef<number | null>(null);
  const userEditedTitleRef = useRef(false);
  useEffect(() => {
    if (!previewDraft || !previewTitleMismatch) return;
    if (!userEditedTitleRef.current) return;
    if (previewEditTitle.trim() === previewDraft.title) return;
    if (previewEditTitle.trim().length === 0) return;

    const draftIdToSave = previewDraft.id;
    const titleToSave = previewEditTitle.trim();
    lastSavedDraftIdRef.current = draftIdToSave;

    setPreviewTitleSaved(false);
    if (previewAutoSaveTimer.current) clearTimeout(previewAutoSaveTimer.current);
    previewAutoSaveTimer.current = setTimeout(async () => {
      if (lastSavedDraftIdRef.current !== draftIdToSave) return;
      if (!userEditedTitleRef.current) return;
      setPreviewSavingTitle(true);
      try {
        const res = await apiRequest("PATCH", `/api/content-studio/drafts/${draftIdToSave}`, {
          title: titleToSave,
        });
        const updated = await res.json();
        setPreviewDraft((prev) => prev && prev.id === draftIdToSave ? { ...prev, title: updated.title } : prev);
        setPreviewTitleSaved(true);
        queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
        setTimeout(() => setPreviewTitleSaved(false), 2000);
      } catch {
        toast({ title: "Error", description: "Failed to save title.", variant: "destructive" });
      } finally {
        setPreviewSavingTitle(false);
      }
    }, 1000);

    return () => {
      if (previewAutoSaveTimer.current) clearTimeout(previewAutoSaveTimer.current);
    };
  }, [previewEditTitle, previewDraft?.id, previewTitleMismatch]);
  
  // Typography settings
  const [selectedTitleFont, setSelectedTitleFont] = useState("Playfair Display");
  const [selectedAuthorFont, setSelectedAuthorFont] = useState("Lora");
  const [selectedEffect, setSelectedEffect] = useState("elegant-glow");
  const [selectedPosition, setSelectedPosition] = useState("top-center");
  const [selectedTitleCase, setSelectedTitleCase] = useState("titlecase");
  
  // Color settings
  const [selectedColorPreset, setSelectedColorPreset] = useState("Auto (from image)");
  const [customTitleColor, setCustomTitleColor] = useState("");
  const [customAuthorColor, setCustomAuthorColor] = useState("");
  const [customOutlineColor, setCustomOutlineColor] = useState("");
  
  // Typography Vault - stores 3-4 AI-generated style options per cover
  interface TypographyStyleOption {
    id: string;
    name: string;
    aesthetic: string;
    titleFont: string;
    authorFont: string;
    titleColor: string;
    authorColor: string;
    titlePosition: "top" | "top-left" | "top-right" | "center" | "bottom" | "bottom-left" | "bottom-right";
    titleAlignment: "left" | "center" | "right";
    authorPosition: "top" | "top-left" | "top-right" | "center" | "bottom" | "bottom-left" | "bottom-right";
    authorAlignment: "left" | "center" | "right";
    titleEffect: string;
    authorEffect: string;
    titleSize: number;
    authorSize: number;
    titleCase: "original" | "uppercase" | "titlecase" | "lowercase";
    authorCase: "original" | "uppercase" | "titlecase" | "lowercase";
    reasoning: string;
    concept?: string;
  }
  
  interface VaultEntry {
    draftId: number;
    styleOptions: TypographyStyleOption[];
    selectedStyleId: string | null;
    coverAnalysis: { dominantColors: string[]; imageStyle: string; mood: string };
  }
  
  // Title adjustment for interactive positioning
  interface TitleAdjustment {
    offsetX: number; // -50 to 50 (percentage)
    offsetY: number; // -30 to 70 (percentage from top)
    scale: number;   // 0.5 to 2.0
  }
  
  const [typographyVault, setTypographyVault] = useState<Map<number, VaultEntry>>(new Map());
  const [selectedStyleForDraft, setSelectedStyleForDraft] = useState<Map<number, string>>(new Map());
  const [loadingVaultFor, setLoadingVaultFor] = useState<Set<number>>(new Set());
  
  // Visual Intelligence - stores cover analysis and complexity decisions per draft
  const [visualIntelligence, setVisualIntelligence] = useState<Map<number, VisualIntelligenceResult>>(new Map());
  
  // Title Perfection Engine - stores perfect title designs per draft
  const [titlePerfection, setTitlePerfection] = useState<Map<number, PerfectTitleDesign>>(new Map());
  
  // Interactive title adjustments - position and size per draft
  const [titleAdjustments, setTitleAdjustments] = useState<Map<number, TitleAdjustment>>(new Map());
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null);
  const [isDraggingTitle, setIsDraggingTitle] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  
  // Loading states
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [finalizingIds, setFinalizingIds] = useState<Set<number>>(new Set());
  const [regeneratingIds, setRegeneratingIds] = useState<Set<number>>(new Set());
  const [isRegeneratingAll, setIsRegeneratingAll] = useState(false);
  const [isRegeneratingSelected, setIsRegeneratingSelected] = useState(false);
  const [regenProgress, setRegenProgress] = useState<string>("");
  const pollCancelledRef = useRef(false);
  useEffect(() => { return () => { pollCancelledRef.current = true; }; }, []);
  const [titleEmbedSync, setTitleEmbedSync] = useState(false);
  const [aiTitleOverlayLoading, setAiTitleOverlayLoading] = useState<Set<number>>(new Set());
  const [selectedModelStyleIds, setSelectedModelStyleIds] = useState<Set<string>>(new Set(["cinematic-openai"]));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["__first__"]));
  const [expandedSectionsInitialized, setExpandedSectionsInitialized] = useState(false);
  const selectedModelStyleId = selectedModelStyleIds.size === 1 ? Array.from(selectedModelStyleIds)[0] : Array.from(selectedModelStyleIds)[0] || "cinematic-openai";
  const toggleStyleSelection = (styleId: string) => {
    setSelectedModelStyleIds(prev => {
      const next = new Set(prev);
      if (next.has(styleId)) {
        if (next.size > 1) next.delete(styleId);
      } else {
        next.add(styleId);
      }
      return next;
    });
  };
  const [autoRefresh, setAutoRefresh] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Reference image state
  const [referenceAnalysis, setReferenceAnalysis] = useState<{
    hasReference: boolean;
    analysis?: {
      description: string;
      style: string;
      colors: string;
      mood: string;
      subjects: string;
      composition: string;
    };
  }>({ hasReference: false });
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  
  // AI Cover Analysis state
  const [coverAnalysis, setCoverAnalysis] = useState<Record<number, CoverAnalysisResult>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<number>>(new Set());

  // Analyze a single cover with AI
  const analyzeCover = async (draftId: number): Promise<CoverAnalysisResult | null> => {
    try {
      setAnalyzingIds(prev => new Set(prev).add(draftId));
      const response = await fetch(`/api/content-studio/analyze-cover/${draftId}`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to analyze cover");
      }
      const analysis = await response.json();
      setCoverAnalysis(prev => ({ ...prev, [draftId]: analysis }));
      return analysis;
    } catch (error) {
      console.error("Error analyzing cover:", error);
      return null;
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    }
  };

  // Generate typography options from vault (creates 12-15 AI-designed styles)
  const generateTypographyFromVault = async (draftId: number, forceRegenerate: boolean = false) => {
    console.log(`[Typography Vault] Starting generation for draft ${draftId}${forceRegenerate ? " [FORCE]" : ""}`);
    setLoadingVaultFor(prev => new Set(prev).add(draftId));
    try {
      const response = await fetch(`/api/typography-vault/generate/${draftId}`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRegenerate })
      });
      const data = await response.json();
      
      console.log(`[Typography Vault] Response for draft ${draftId}:`, {
        success: data.success,
        styleCount: data.styleOptions?.length || 0,
        error: data.error
      });
      
      // Accept styles if they exist (even if success is undefined)
      if (data.styleOptions && data.styleOptions.length > 0) {
        setTypographyVault(prev => {
          const next = new Map(prev);
          next.set(draftId, {
            draftId,
            styleOptions: data.styleOptions,
            selectedStyleId: null,
            coverAnalysis: data.coverAnalysis || { dominantColors: [], imageStyle: "", mood: "" }
          });
          return next;
        });
        // Auto-select first style
        // Pick a DIFFERENT style for each book based on title hash
        // This ensures variety across books instead of always style-1
        const draft = drafts?.find((d: any) => d.id === draftId);
        const titleHash = (draft?.title || "").split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const styleIndex = titleHash % data.styleOptions.length;
        const selectedStyle = data.styleOptions[styleIndex] || data.styleOptions[0];
        
        setSelectedStyleForDraft(prev => {
          const next = new Map(prev);
          next.set(draftId, selectedStyle.id);
          return next;
        });
        console.log(`[Typography Vault] Draft ${draftId}: ${data.styleOptions.length} styles loaded, selected: ${selectedStyle.id} (index ${styleIndex})`);
        return true;
      } else {
        console.warn(`[Typography Vault] Draft ${draftId}: No styles returned from API`);
      }
      return false;
    } catch (error) {
      console.error(`[Typography Vault] Error for draft ${draftId}:`, error);
      return false;
    } finally {
      setLoadingVaultFor(prev => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    }
  };

  // Analyze cover using Visual Intelligence (client-side image analysis)
  const analyzeWithVisualIntelligence = async (draft: DraftEbook) => {
    const imageUrl = draft.coverUrl || draft.backgroundUrl;
    if (!imageUrl) return null;
    
    try {
      console.log(`[Visual Intelligence] Analyzing cover for draft ${draft.id}: ${draft.title}`);
      const result = await analyzeForTypography(imageUrl, draft.title, draft.genre, draft.topic || '');
      
      console.log(`[Visual Intelligence] Analysis complete for draft ${draft.id}:`, {
        styleCategory: result.complexityDecision.styleCategory,
        complexityScore: (result.complexityDecision.finalScore * 100).toFixed(1) + '%',
        shouldUseUnique: result.complexityDecision.shouldUseUnique,
        dominantColors: result.coverAnalysis.dominantColors.slice(0, 3),
        optimalPosition: result.coverAnalysis.optimalPlacement.position
      });
      
      setVisualIntelligence(prev => {
        const next = new Map(prev);
        next.set(draft.id, result);
        return next;
      });
      
      return result;
    } catch (error) {
      console.error(`[Visual Intelligence] Failed for draft ${draft.id}:`, error);
      return null;
    }
  };

  // Analyze cover with Title Perfection Engine (NEW)
  const analyzeWithTitlePerfection = async (draft: DraftEbook) => {
    const imageUrl = draft.coverUrl || draft.backgroundUrl;
    if (!imageUrl) return null;
    
    try {
      console.log(`[Title Perfection] Analyzing cover for draft ${draft.id}: ${draft.title}`);
      const result = await titlePerfectionEngine.generatePerfectTitle(
        imageUrl, 
        draft.title, 
        "EbookGamez", 
        draft.genre
      );
      
      console.log(`[Title Perfection] Analysis complete for draft ${draft.id}:`, {
        complexityLevel: result.styleDecision.complexityLevel,
        layoutType: result.styleDecision.layoutType,
        primaryColor: result.colors.primary,
        primaryEffect: result.effects.primary,
        useTwoTone: result.styleDecision.useTwoTone,
        useMultiColor: result.styleDecision.useMultiColor
      });
      
      setTitlePerfection(prev => {
        const next = new Map(prev);
        next.set(draft.id, result);
        return next;
      });
      
      return result;
    } catch (error) {
      console.error(`[Title Perfection] Failed for draft ${draft.id}:`, error);
      return null;
    }
  };

  // Apply a vault style to the typography settings
  const applyVaultStyle = (draftId: number, styleId: string) => {
    const entry = typographyVault.get(draftId);
    if (!entry) return;
    
    const style = entry.styleOptions.find(s => s.id === styleId);
    if (!style) return;
    
    // Update selected style
    setSelectedStyleForDraft(prev => {
      const next = new Map(prev);
      next.set(draftId, styleId);
      return next;
    });
    
    // Update typography settings to match selected style
    setSelectedTitleFont(style.titleFont);
    setSelectedAuthorFont(style.authorFont);
    setSelectedEffect(style.titleEffect);
    setSelectedTitleCase(style.titleCase);
    setCustomTitleColor(style.titleColor);
    setCustomAuthorColor(style.authorColor);
    setSelectedColorPreset("Custom");
    
    // Save selection to vault
    fetch(`/api/typography-vault/${draftId}/select`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ styleId })
    }).catch(console.error);
    
    toast({ title: "Style Applied", description: `Applied "${style.name}" typography` });
  };

  // Cycle through vault styles for a draft (prev/next navigation)
  const cycleVaultStyle = (draftId: number, direction: "prev" | "next") => {
    const entry = typographyVault.get(draftId);
    if (!entry || entry.styleOptions.length === 0) return;
    
    // Auto-select this draft so preview/finalize works on the right book
    if (selectedDraftId !== draftId) {
      setSelectedDraftId(draftId);
    }
    
    const currentStyleId = selectedStyleForDraft.get(draftId);
    let currentIndex = currentStyleId 
      ? entry.styleOptions.findIndex(s => s.id === currentStyleId)
      : 0;
    
    // Guard against -1 if style ID not found
    if (currentIndex < 0) currentIndex = 0;
    
    let newIndex: number;
    if (direction === "next") {
      newIndex = (currentIndex + 1) % entry.styleOptions.length;
    } else {
      newIndex = (currentIndex - 1 + entry.styleOptions.length) % entry.styleOptions.length;
    }
    
    const newStyle = entry.styleOptions[newIndex];
    if (newStyle) {
      applyVaultStyle(draftId, newStyle.id);
    }
  };

  // Get current style info for display
  const getCurrentStyleInfo = (draftId: number) => {
    const entry = typographyVault.get(draftId);
    if (!entry || entry.styleOptions.length === 0) return null;
    
    const currentStyleId = selectedStyleForDraft.get(draftId);
    let currentIndex = currentStyleId 
      ? entry.styleOptions.findIndex(s => s.id === currentStyleId)
      : 0;
    
    // Guard against -1 if style ID not found
    if (currentIndex < 0) currentIndex = 0;
    
    const style = entry.styleOptions[currentIndex];
    if (!style) return null;
    
    return {
      name: style.name,
      index: currentIndex + 1,
      total: entry.styleOptions.length,
    };
  };

  // Analyze multiple covers and show AI-recommended text
  const analyzeAndShowText = async (draftIds: number[], forceRegenerate: boolean = true) => {
    console.log(`[AI Show Text] Starting for ${draftIds.length} drafts:`, draftIds, forceRegenerate ? "[FORCE REGEN]" : "");
    setIsAnalyzing(true);
    toast({ title: "AI Typography", description: `AI is analyzing ${draftIds.length} book(s) one by one to create unique styles...` });
    
    let successCount = 0;
    let failCount = 0;
    
    // Process ONE book at a time with 2-second delays to avoid rate limits
    for (let i = 0; i < draftIds.length; i++) {
      const id = draftIds[i];
      console.log(`[AI Show Text] Processing book ${i + 1}/${draftIds.length}: draft ${id}`);
      
      const success = await generateTypographyFromVault(id, forceRegenerate);
      if (success) {
        successCount++;
      } else {
        failCount++;
        console.warn(`[AI Show Text] Failed to generate AI styles for draft ${id}`);
      }
      
      // Add 10-second delay between books to avoid rate limits
      if (i < draftIds.length - 1) {
        console.log(`[AI Show Text] Waiting 10 seconds before next book...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    console.log(`[AI Show Text] AI Typography complete: ${successCount} success, ${failCount} failed`);
    
    // Also do legacy analysis for immediate display (fallback for cases where vault fails)
    for (let i = 0; i < draftIds.length; i += 3) {
      const batch = draftIds.slice(i, i + 3);
      await Promise.all(batch.map(id => analyzeCover(id)));
    }
    
    // Run Visual Intelligence analysis on all covers (client-side image analysis)
    console.log(`[AI Show Text] Running Visual Intelligence on ${draftIds.length} covers...`);
    const viPromises = draftIds.map(id => {
      const draft = drafts?.find((d: DraftEbook) => d.id === id);
      if (draft) return analyzeWithVisualIntelligence(draft);
      return Promise.resolve(null);
    });
    await Promise.all(viPromises);
    console.log(`[AI Show Text] Visual Intelligence analysis complete`);
    
    // Run Title Perfection Engine on all covers (NEW - enhanced analysis)
    console.log(`[AI Show Text] Running Title Perfection Engine on ${draftIds.length} covers...`);
    const tpPromises = draftIds.map(id => {
      const draft = drafts?.find((d: DraftEbook) => d.id === id);
      if (draft) return analyzeWithTitlePerfection(draft);
      return Promise.resolve(null);
    });
    await Promise.all(tpPromises);
    console.log(`[AI Show Text] Title Perfection Engine analysis complete`);
    
    // Show text for all analyzed covers
    setTextPreviewIds(new Set(draftIds));
    setIsAnalyzing(false);
    
    if (successCount > 0) {
      toast({ title: "AI Analysis Complete", description: `Created unique styles for ${successCount} book(s) with Visual Intelligence - click a cover to see choices` });
    } else {
      toast({ title: "AI Analysis Issue", description: "Could not generate unique styles - using genre-based fallback", variant: "destructive" });
    }
  };

  // Analyze covers using Replit AI (embedded-style thinking like 239-253 covers)
  const analyzeAndShowTextReplitStyle = async (draftIds: number[]) => {
    console.log(`[Replit AI Show Text] Starting for ${draftIds.length} drafts:`, draftIds);
    setIsAnalyzing(true);
    toast({ title: "Replit AI Typography", description: `Replit AI is designing embedded-style titles for ${draftIds.length} book(s)...` });
    
    let successCount = 0;
    let failCount = 0;
    
    // Process ONE book at a time with delays
    for (let i = 0; i < draftIds.length; i++) {
      const id = draftIds[i];
      console.log(`[Replit AI Show Text] Processing book ${i + 1}/${draftIds.length}: draft ${id}`);
      
      try {
        const response = await fetch(`/api/typography-vault/generate-replit/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[Replit AI Show Text] Response for draft ${id}:`, { success: data.success, styleCount: data.styleOptions?.length });
          
          if (data.success && data.styleOptions?.length > 0) {
            successCount++;
            // Update local vault cache
            setTypographyVault(prev => new Map(prev).set(id, data));
            // Auto-select first style
            const firstStyle = data.styleOptions[0];
            if (firstStyle) {
              setSelectedStyleForDraft(prev => {
                const next = new Map(prev);
                next.set(id, firstStyle.id);
                return next;
              });
            }
          } else {
            failCount++;
          }
        } else {
          failCount++;
        }
      } catch (error) {
        console.error(`[Replit AI Show Text] Error for draft ${id}:`, error);
        failCount++;
      }
      
      // Add 5-second delay between books
      if (i < draftIds.length - 1) {
        console.log(`[Replit AI Show Text] Waiting 5 seconds before next book...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`[Replit AI Show Text] Complete: ${successCount} success, ${failCount} failed`);
    
    // Run Visual Intelligence and Title Perfection for additional analysis
    const viPromises = draftIds.map(id => {
      const draft = drafts?.find((d: DraftEbook) => d.id === id);
      if (draft) return analyzeWithVisualIntelligence(draft);
      return Promise.resolve(null);
    });
    await Promise.all(viPromises);
    
    const tpPromises = draftIds.map(id => {
      const draft = drafts?.find((d: DraftEbook) => d.id === id);
      if (draft) return analyzeWithTitlePerfection(draft);
      return Promise.resolve(null);
    });
    await Promise.all(tpPromises);
    
    // Show text for all analyzed covers
    setTextPreviewIds(new Set(draftIds));
    setIsAnalyzing(false);
    
    if (successCount > 0) {
      toast({ title: "Replit AI Complete", description: `Created embedded-style titles for ${successCount} book(s) - designed to look naturally integrated` });
    } else {
      toast({ title: "Replit AI Issue", description: "Could not generate styles - check if Replit AI is available", variant: "destructive" });
    }
  };

  // Title adjustment helpers
  const getTitleAdjustment = (draftId: number): TitleAdjustment => {
    return titleAdjustments.get(draftId) || { offsetX: 0, offsetY: 0, scale: 1.0 };
  };
  
  const updateTitleAdjustment = (draftId: number, updates: Partial<TitleAdjustment>) => {
    setTitleAdjustments(prev => {
      const newMap = new Map(prev);
      const current = prev.get(draftId) || { offsetX: 0, offsetY: 0, scale: 1.0 };
      newMap.set(draftId, { ...current, ...updates });
      return newMap;
    });
  };
  
  // Track if we actually dragged (moved more than a few pixels)
  const didDragRef = useRef(false);
  
  const handleTitleMouseDown = (e: React.MouseEvent, draftId: number) => {
    e.stopPropagation();
    e.preventDefault();
    const adjustment = getTitleAdjustment(draftId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: adjustment.offsetX,
      startY: adjustment.offsetY
    };
    didDragRef.current = false;
    setIsDraggingTitle(true);
    setEditingTitleId(draftId);
  };
  
  const handleTitleMouseUp = (e: React.MouseEvent, draftId: number) => {
    e.stopPropagation();
    // Only toggle off if we clicked without dragging AND we're already editing this title
    // If we dragged, keep the controls visible
    if (!didDragRef.current && editingTitleId === draftId) {
      // This was just a click on an already-selected title - keep it selected
      // (don't toggle off, let user use the controls)
    }
  };
  
  // Global mouse move handler for dragging
  useEffect(() => {
    if (!isDraggingTitle || editingTitleId === null) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      // Mark as dragged if moved more than 5 pixels
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        didDragRef.current = true;
      }
      
      // Convert pixel movement to percentage (approximate based on typical cover size)
      const newOffsetX = Math.max(-50, Math.min(50, dragStartRef.current.startX + dx / 2));
      const newOffsetY = Math.max(-30, Math.min(70, dragStartRef.current.startY + dy / 2));
      
      updateTitleAdjustment(editingTitleId, { offsetX: newOffsetX, offsetY: newOffsetY });
    };
    
    const handleMouseUp = () => {
      setIsDraggingTitle(false);
      dragStartRef.current = null;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingTitle, editingTitleId]);

  const downloadSelectedCoversZip = (format: string = "png") => {
    const ids = selectedDraftIds.size > 0 
      ? Array.from(selectedDraftIds).join(",")
      : draftsForReview.map(d => d.id).join(",");
    const count = selectedDraftIds.size > 0 ? selectedDraftIds.size : draftsForReview.length;
    
    if (format === "epub") {
      // Use the dedicated EPUB endpoint for better generation
      window.location.href = `/api/content-studio/download-epubs-zip?ids=${ids}`;
      toast({ title: "Download started", description: `Generating ${count} EPUBs - this may take a moment...` });
    } else {
      window.location.href = `/api/content-studio/download-covers-zip?ids=${ids}&format=${format}`;
      toast({ title: "Download started", description: `Downloading ${count} covers as ${format.toUpperCase()} in ZIP` });
    }
  };

  const handleUploadCoversZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await fetch("/api/content-studio/upload-covers-zip", {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Upload complete", description: `Updated ${data.updated} covers` });
        queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
      } else {
        toast({ title: "Upload failed", description: data.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Upload error", description: "Failed to upload covers", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const { data: rawDrafts = [], isLoading: loadingDrafts } = useQuery<DraftEbook[]>({
    queryKey: ["/api/content-studio/ready-for-review"],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: bookRequestsData, refetch: refetchBookRequests } = useQuery<{ requests: BookRequestRow[] }>({
    queryKey: ["/api/content-studio/book-requests"],
    enabled: showResearchDialog,
  });
  const bookRequests = bookRequestsData?.requests ?? [];
  const pendingRequests = bookRequests.filter((r) => r.status === "pending");
  const approvedRequests = bookRequests.filter((r) => r.status === "approved");

  const researchTitlesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/content-studio/research-titles", {
        count: researchCount,
        includeCustomerRequests,
        focusNotes: researchFocusNotes.trim() || undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Research failed");
      }
      return res.json() as Promise<ResearchTitlesResult>;
    },
    onSuccess: (data) => {
      setLastResearchResult(data);
      setExpandedSections((prev) => new Set([...prev, "__placers__"]));
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
      refetchBookRequests();
      toast({
        title: "New title placers ready",
        description: `Created ${data.createdDraftIds.length} drafts — scroll to the bottom of Cover Review, section "Awaiting AI Style & Cover".`,
      });
      setTimeout(() => {
        document.getElementById("section-title-placers")?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 400);
    },
    onError: (error: Error) => {
      toast({ title: "Research failed", description: error.message, variant: "destructive" });
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" | "pending" }) => {
      const res = await apiRequest("PATCH", `/api/content-studio/book-requests/${id}`, { status });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchBookRequests();
    },
    onError: (error: Error) => {
      toast({ title: "Could not update request", description: error.message, variant: "destructive" });
    },
  });

  
  // Sort drafts to show priority covers at the top (The Inkborn Chronicles, The Forgotten Pantheon, The Shadow Algorithm)
  const priorityIds = [275, 272, 269]; // IDs of the gold standard covers
  const drafts = useMemo(() => {
    return [...rawDrafts].sort((a, b) => {
      const aIsPriority = priorityIds.includes(a.id);
      const bIsPriority = priorityIds.includes(b.id);
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      if (aIsPriority && bIsPriority) {
        return priorityIds.indexOf(a.id) - priorityIds.indexOf(b.id);
      }
      return b.id - a.id; // Otherwise sort by ID descending (newest first)
    });
  }, [rawDrafts]);

  // Auto-enable refresh when regenerating, auto-disable after 5 minutes
  useEffect(() => {
    if (isRegeneratingSelected || isRegeneratingAll) {
      setAutoRefresh(true);
      const timeout = setTimeout(() => setAutoRefresh(false), 5 * 60 * 1000);
      return () => clearTimeout(timeout);
    }
  }, [isRegeneratingSelected, isRegeneratingAll]);

  const { data: fontOptions } = useQuery<FontOptions>({
    queryKey: ["/api/content-studio/font-options"],
  });

  const { data: publishedBooks = [] } = useQuery<Array<{ id: number; title: string }>>({
    queryKey: ["/api/books/published-titles"],
  });

  // Generate preview for selected cover
  const generatePreview = async () => {
    if (!selectedDraftId) return;
    
    setIsGeneratingPreview(true);
    try {
      const colorPreset = fontOptions?.colorPresets?.find(p => p.name === selectedColorPreset);
      
      const response = await apiRequest("POST", "/api/content-studio/preview-cover", {
        draftId: selectedDraftId,
        titleFont: selectedTitleFont,
        authorFont: selectedAuthorFont,
        effect: selectedEffect,
        position: selectedPosition,
        titleCase: selectedTitleCase,
        titleColor: colorPreset?.titleColor || customTitleColor || undefined,
        authorColor: colorPreset?.authorColor || customAuthorColor || undefined,
        outlineColor: colorPreset?.outlineColor || customOutlineColor || undefined,
      });
      const data = await response.json();
      // Add data URL prefix if needed
      const imageDataUrl = data.preview.startsWith('data:') 
        ? data.preview 
        : `data:image/png;base64,${data.preview}`;
      setPreviewImage(imageDataUrl);
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Finalize single cover
  const finalizeSingleCover = async (draftId: number) => {
    setFinalizingIds(prev => new Set(prev).add(draftId));
    try {
      const colorPreset = fontOptions?.colorPresets?.find(p => p.name === selectedColorPreset);
      
      await apiRequest("POST", "/api/content-studio/finalize-cover", {
        draftId,
        options: {
          titleFont: selectedTitleFont,
          authorFont: selectedAuthorFont,
          effect: selectedEffect,
          position: selectedPosition,
          titleCase: selectedTitleCase,
          titleColor: colorPreset?.titleColor || customTitleColor || undefined,
          authorColor: colorPreset?.authorColor || customAuthorColor || undefined,
          outlineColor: colorPreset?.outlineColor || customOutlineColor || undefined,
        }
      });
      toast({ title: "Success", description: "Cover finalized!" });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch (error) {
      toast({ title: "Error", description: "Failed to finalize cover", variant: "destructive" });
    } finally {
      setFinalizingIds(prev => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    }
  };

  // Finalize with ORIGINAL 239-253 styling (the gold standard)
  const finalizeWithOriginalStyle = async (draftId: number) => {
    setFinalizingIds(prev => new Set(prev).add(draftId));
    try {
      await apiRequest("POST", "/api/content-studio/finalize-cover", {
        draftId,
        options: { useOriginalStyle: true }
      });
      toast({ title: "Success", description: "Cover finalized with original 239-253 style!" });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch (error) {
      toast({ title: "Error", description: "Failed to finalize cover", variant: "destructive" });
    } finally {
      setFinalizingIds(prev => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    }
  };
  
  // Batch finalize with ORIGINAL 239-253 styling
  const [batchOriginalStylePending, setBatchOriginalStylePending] = useState(false);
  const batchFinalizeOriginalStyle = async () => {
    setBatchOriginalStylePending(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const draft of draftsForReview) {
      try {
        await apiRequest("POST", "/api/content-studio/finalize-cover", {
          draftId: draft.id,
          options: { useOriginalStyle: true }
        });
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    setBatchOriginalStylePending(false);
    toast({ 
      title: "Batch Complete", 
      description: `${successCount} covers finalized with original style, ${errorCount} errors` 
    });
    queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
  };

  // Apply two-tone title bar to a single cover
  const [titleBarIds, setTitleBarIds] = useState<Set<number>>(new Set());
  const applyTitleBar = async (draftId: number) => {
    setTitleBarIds(prev => new Set(prev).add(draftId));
    try {
      await apiRequest("POST", `/api/content-studio/apply-title-bar/${draftId}`);
      toast({ title: "Success", description: "Title bar applied!" });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch (error) {
      toast({ title: "Error", description: "Failed to apply title bar", variant: "destructive" });
    } finally {
      setTitleBarIds(prev => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    }
  };

  // Apply two-tone title bar to selected covers (batch)
  const [batchTitleBarPending, setBatchTitleBarPending] = useState(false);
  const batchApplyTitleBar = async () => {
    const selectedIds = Array.from(selectedDraftIds);
    if (selectedIds.length === 0) {
      toast({ title: "No covers selected", description: "Select covers first", variant: "destructive" });
      return;
    }
    setBatchTitleBarPending(true);
    try {
      const response = await apiRequest("POST", "/api/content-studio/apply-title-bar-batch", { draftIds: selectedIds });
      const data = await response.json();
      toast({ title: "Batch Complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch (error) {
      toast({ title: "Error", description: "Failed to apply title bars", variant: "destructive" });
    } finally {
      setBatchTitleBarPending(false);
    }
  };

  // Regenerate single background
  const regenerateSingleBackground = async (draftId: number) => {
    setRegeneratingIds(prev => new Set(prev).add(draftId));
    try {
      await apiRequest("POST", `/api/content-studio/regenerate-background/${draftId}`);
      toast({ title: "Success", description: "New background generated!" });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
      setPreviewImage(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to regenerate background", variant: "destructive" });
    } finally {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(draftId);
        return next;
      });
    }
  };

  // Toggle selection for a cover
  const toggleSelection = (draftId: number) => {
    setSelectedDraftIds(prev => {
      const next = new Set(prev);
      if (next.has(draftId)) {
        next.delete(draftId);
      } else {
        next.add(draftId);
      }
      return next;
    });
    setSelectedDraftId(draftId);
    setPreviewImage(null);
  };

  // Select all covers
  const selectAll = () => {
    setSelectedDraftIds(new Set(draftsForReview.map(d => d.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedDraftIds(new Set());
  };

  // Regenerate selected backgrounds with selected style(s)
  const regenerateSelectedBackgrounds = async () => {
    console.log("=== REGENERATE SELECTED CLICKED ===");
    console.log("selectedDraftIds size:", selectedDraftIds.size);
    console.log("selectedModelStyleIds:", Array.from(selectedModelStyleIds));
    
    if (selectedDraftIds.size === 0) {
      console.log("No drafts selected, returning early");
      return;
    }
    
    setIsRegeneratingSelected(true);
    setRegenProgress("");
    pollCancelledRef.current = false;
    try {
      const draftIds = Array.from(selectedDraftIds);
      const styleIds = Array.from(selectedModelStyleIds);
      const styleNames: Record<string, string> = {
        "replit-cinematic": "Classic Library 239 (Original)",
        "dalle3-vivid": "DALL-E 3 Vivid",
        "cinematic-openai": "Cinematic via OpenAI",
        "artistic-painterly": "Artistic Painterly",
        "artistic-compact": "Artistic Compact",
        "vivid-atmospheric": "Vivid Atmospheric",
        "standalone-scenes": "Standalone Scenes",
        "reference-inspired": "Reference Inspired",
        "vivid-painterly-pro": "Vivid Painterly Pro",
        "atmospheric-cinema": "Atmospheric Cinema",
        "experimental-239": "Experimental 239",
        "full-ai-auto": "Full AI Auto",
        "test-style-a": "Test A",
        "test-style-b": "Test B",
        "test-style-c": "Test C",
        "test-style-d": "Test D",
        "test-style-e": "Test E",
        "test-style-f": "Test F",
        "test-style-g": "Test G",
        "test-style-h": "Test H"
      };
      
      let totalGenerated = 0;
      
      if (styleIds.length === 1) {
        const styleId = styleIds[0];
        if (styleId === "full-ai-auto") {
          console.log("Using Full AI Auto mode for", draftIds.length, "drafts");
          await apiRequest("POST", "/api/content-studio/bulk-full-ai-auto", { draftIds });
          totalGenerated += draftIds.length;
        } else {
          console.log("Sending request with:", { draftIds, modelStyleId: styleId, titleEmbedSync });
          const response = await apiRequest("POST", "/api/content-studio/regenerate-selected-backgrounds", {
            draftIds,
            modelStyleId: styleId,
            titleEmbedSync
          });
          const data = await response.json();
          totalGenerated += data.total || draftIds.length;
        }
      } else {
        const stylePool = styleIds.filter((id) => id !== "full-ai-auto");
        if (stylePool.length === 0) {
          toast({ title: "No styles selected", description: "Choose at least one cover style", variant: "destructive" });
          setIsRegeneratingSelected(false);
          return;
        }
        console.log("AI smart style selection from pool:", stylePool, "for", draftIds.length, "drafts");
        const response = await apiRequest("POST", "/api/content-studio/regenerate-selected-backgrounds", {
          draftIds,
          modelStyleIds: stylePool,
          titleEmbedSync,
        });
        const data = await response.json();
        totalGenerated += data.total || draftIds.length;
      }
      
      const selectedNames = styleIds.map(id => styleNames[id] || id).join(", ");
      toast({ 
        title: "Regeneration Started", 
        description: styleIds.length > 1 
          ? `AI picking the best style per book from ${styleIds.filter(id => id !== "full-ai-auto").length} options for ${draftIds.length} covers` 
          : `Regenerating ${totalGenerated} covers with ${selectedNames} style`
      });
      clearSelection();
      
      const pollStatus = async () => {
        let attempts = 0;
        const maxAttempts = 120;
        while (attempts < maxAttempts && !pollCancelledRef.current) {
          await new Promise(r => setTimeout(r, 5000));
          if (pollCancelledRef.current) break;
          attempts++;
          try {
            const statusRes = await fetch("/api/content-studio/regeneration-status", {
              headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
            });
            const status = await statusRes.json();
            if (status.running && status.progress) {
              setRegenProgress(status.progress);
            }
            if (!status.running) {
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
              if (status.lastResult) {
                const { total, generated, errors } = status.lastResult;
                if (errors > 0) {
                  toast({ 
                    title: `Generation Complete: ${generated}/${total} succeeded`, 
                    description: `${errors} failed. ${status.lastError ? `Last error: ${status.lastError.substring(0, 120)}` : ""}`,
                    variant: "destructive",
                    duration: 15000
                  });
                } else {
                  toast({ 
                    title: "Generation Complete", 
                    description: `${generated}/${total} covers generated successfully!`,
                    duration: 8000
                  });
                }
              } else if (status.lastError) {
                toast({ 
                  title: "Generation Failed", 
                  description: status.lastError.substring(0, 150),
                  variant: "destructive",
                  duration: 15000
                });
              }
              setIsRegeneratingSelected(false);
              setRegenProgress("");
              return;
            }
          } catch { }
        }
        setIsRegeneratingSelected(false);
        setRegenProgress("");
        queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
      };
      pollStatus();
    } catch (error: any) {
      const message = error?.message || "Failed to start regeneration";
      toast({
        title: message.includes("already running") ? "Batch In Progress" : "Error",
        description: message,
        variant: "destructive",
      });
      setIsRegeneratingSelected(false);
    }
  };

  const [removingTitleIds, setRemovingTitleIds] = useState<Set<number>>(new Set());
  const [isRemovingAllTitles, setIsRemovingAllTitles] = useState(false);

  const handleRemoveAllTitles = async () => {
    if (!confirm("Are you sure you want to remove ALL title bars from every cover? This cannot be undone easily.")) return;
    setIsRemovingAllTitles(true);
    try {
      const response = await apiRequest("POST", "/api/content-studio/remove-title-batch", {});
      const data = await response.json();
      toast({ title: "Title Bars Removed", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to remove title bars", variant: "destructive" });
    } finally {
      setIsRemovingAllTitles(false);
    }
  };

  const handleRemoveTitle = async (draftId: number) => {
    setRemovingTitleIds(prev => new Set(prev).add(draftId));
    try {
      const response = await apiRequest("POST", `/api/content-studio/remove-title/${draftId}`);
      const data = await response.json();
      if (data.cleared === "backgroundOnly" || data.cleared === "both") {
        toast({ title: "Title Cleared", description: data.message });
      } else if (data.cleared === "coverOnly") {
        toast({ title: "Title Removed", description: "Reverted to clean background" });
      } else {
        toast({ title: "No Change", description: data.message });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to remove title", variant: "destructive" });
    } finally {
      setRemovingTitleIds(prev => { const next = new Set(prev); next.delete(draftId); return next; });
    }
  };

  const handleAiTitleOverlay = async (draftId: number) => {
    setAiTitleOverlayLoading(prev => new Set(prev).add(draftId));
    try {
      const response = await apiRequest("POST", `/api/content-studio/ai-title-overlay/${draftId}`);
      const data = await response.json();
      toast({ title: "AI Title Overlay Applied", description: "Title has been artistically added to the cover" });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to apply AI title overlay", variant: "destructive" });
    } finally {
      setAiTitleOverlayLoading(prev => { const next = new Set(prev); next.delete(draftId); return next; });
    }
  };

  const [batchAiOverlayPending, setBatchAiOverlayPending] = useState(false);
  const batchAiTitleOverlay = async () => {
    const selectedIds = Array.from(selectedDraftIds);
    if (selectedIds.length === 0) {
      toast({ title: "No covers selected", description: "Select covers first", variant: "destructive" });
      return;
    }
    setBatchAiOverlayPending(true);
    selectedIds.forEach(id => setAiTitleOverlayLoading(prev => new Set(prev).add(id)));
    try {
      const response = await apiRequest("POST", "/api/content-studio/ai-title-overlay-batch", { draftIds: selectedIds });
      const data = await response.json();
      toast({ title: "Batch AI Title Overlay Complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to apply batch AI title overlay", variant: "destructive" });
    } finally {
      setBatchAiOverlayPending(false);
      setAiTitleOverlayLoading(new Set());
    }
  };

  // Regenerate all backgrounds
  const regenerateAllBackgrounds = async () => {
    setIsRegeneratingAll(true);
    try {
      const response = await apiRequest("POST", "/api/content-studio/regenerate-all-backgrounds");
      const data = await response.json();
      toast({ 
        title: "Regeneration Complete", 
        description: `Generated ${data.updated} new backgrounds` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch (error) {
      toast({ title: "Error", description: "Failed to regenerate backgrounds", variant: "destructive" });
    } finally {
      setIsRegeneratingAll(false);
    }
  };

  // Fetch reference analysis status on load
  useEffect(() => {
    const fetchReferenceStatus = async () => {
      try {
        const response = await fetch("/api/content-studio/reference-analysis", {
          headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        });
        if (response.ok) {
          const data = await response.json();
          setReferenceAnalysis(data);
        }
      } catch (error) {
        console.error("Failed to fetch reference status:", error);
      }
    };
    fetchReferenceStatus();
  }, []);

  // Upload reference image
  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingReference(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch("/api/content-studio/upload-reference-image", {
        method: "POST",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      
      const data = await response.json();
      setReferenceAnalysis({ hasReference: true, analysis: data.analysis });
      setSelectedModelStyleIds(new Set(["reference-inspired"]));
      toast({ 
        title: "Reference Image Uploaded", 
        description: `Style: ${data.analysis.style}. Colors: ${data.analysis.colors.substring(0, 50)}...` 
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload reference image", variant: "destructive" });
    } finally {
      setIsUploadingReference(false);
      if (referenceInputRef.current) {
        referenceInputRef.current.value = '';
      }
    }
  };

  // Clear reference
  const clearReference = async () => {
    try {
      await fetch("/api/content-studio/reference-analysis", {
        method: "DELETE",
        headers: { "x-admin-token": localStorage.getItem("ebgz_admin_token") || "" },
      });
      setReferenceAnalysis({ hasReference: false });
      if (selectedModelStyleIds.has("reference-inspired")) {
        setSelectedModelStyleIds(new Set(["vivid-atmospheric"]));
      }
      toast({ title: "Reference Cleared", description: "Reference image removed" });
    } catch (error) {
      console.error("Failed to clear reference:", error);
    }
  };

  // Finalize all covers
  const batchFinalizeMutation = useMutation({
    mutationFn: async () => {
      const colorPreset = fontOptions?.colorPresets?.find(p => p.name === selectedColorPreset);
      
      const response = await apiRequest("POST", "/api/content-studio/batch-finalize-covers", {
        titleFont: selectedTitleFont,
        authorFont: selectedAuthorFont,
        effect: selectedEffect,
        position: selectedPosition,
        titleCase: selectedTitleCase,
        titleColor: colorPreset?.titleColor || customTitleColor || undefined,
        authorColor: colorPreset?.authorColor || customAuthorColor || undefined,
        outlineColor: colorPreset?.outlineColor || customOutlineColor || undefined,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Batch Complete", 
        description: `Applied text to ${data.updated} covers` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to finalize covers", variant: "destructive" });
    }
  });

  const swapFileInputRef = useRef<HTMLInputElement>(null);
  const [swapTargetId, setSwapTargetId] = useState<number | null>(null);

  const deleteCoverMutation = useMutation({
    mutationFn: async (draftId: number) => {
      const response = await apiRequest("DELETE", `/api/content-studio/drafts/${draftId}/cover`);
      return response.json();
    },
    onSuccess: (_data, draftId) => {
      toast({ title: "Cover Deleted", description: `Removed cover image from draft #${draftId}` });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete cover", variant: "destructive" });
    }
  });

  const deleteEbookMutation = useMutation({
    mutationFn: async (draftId: number) => {
      const response = await apiRequest("DELETE", `/api/content-studio/drafts/${draftId}`);
      return response.json();
    },
    onSuccess: (_data, draftId) => {
      toast({ title: "Ebook Deleted", description: `Removed ebook #${draftId} completely` });
      setSelectedDraftIds(prev => { const next = new Set(prev); next.delete(draftId); return next; });
      if (selectedDraftId === draftId) setSelectedDraftId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete ebook", variant: "destructive" });
    }
  });

  const reassignCoverMutation = useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: number; toId: number }) => {
      const response = await apiRequest("POST", "/api/content-studio/reassign-cover", { fromId, toId });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Cover Moved", description: data.message || "Cover reassigned successfully" });
      setReassignSourceId(null);
      setReassignSearch("");
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to reassign cover", variant: "destructive" });
    }
  });

  const [bulkDeleting, setBulkDeleting] = useState(false);
  const bulkDeleteEbooks = async () => {
    const ids = Array.from(selectedDraftIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} ebook${ids.length !== 1 ? "s" : ""} entirely? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      let deleted = 0;
      for (const id of ids) {
        await apiRequest("DELETE", `/api/content-studio/drafts/${id}`);
        deleted++;
      }
      toast({ title: "Ebooks Deleted", description: `Removed ${deleted} ebook${deleted !== 1 ? "s" : ""} completely.` });
      setSelectedDraftIds(new Set());
      setSelectedDraftId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    } catch {
      toast({ title: "Error", description: "Failed to delete some ebooks. Please try again.", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const swapCoverMutation = useMutation({
    mutationFn: async ({ draftId, file }: { draftId: number; file: File }) => {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(`/api/content-studio/drafts/${draftId}/swap-cover`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to swap cover");
      return response.json();
    },
    onSuccess: (_data, { draftId }) => {
      toast({ title: "Cover Swapped", description: `Replaced cover image for draft #${draftId}` });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to swap cover", variant: "destructive" });
    }
  });

  const swapBetweenMutation = useMutation({
    mutationFn: async ({ draftIdA, draftIdB }: { draftIdA: number; draftIdB: number }) => {
      const response = await apiRequest("POST", "/api/content-studio/swap-covers", { draftIdA, draftIdB });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Covers Switched", description: data.message || "Covers swapped between the two selected ebooks" });
      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
      setSelectedDraftIds(new Set());
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to swap covers", variant: "destructive" });
    }
  });

  const handleSwapFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && swapTargetId) {
      swapCoverMutation.mutate({ draftId: swapTargetId, file });
    }
    e.target.value = "";
    setSwapTargetId(null);
  };

  const duplicateTitles = useMemo(() => {
    const titleCounts = new Map<string, number[]>();
    drafts.forEach(d => {
      const normalizedTitle = (d.title || "").trim().toLowerCase();
      if (!normalizedTitle) return;
      const existing = titleCounts.get(normalizedTitle) || [];
      existing.push(d.id);
      titleCounts.set(normalizedTitle, existing);
    });
    const dupes = new Map<string, number[]>();
    titleCounts.forEach((ids, title) => {
      if (ids.length > 1) dupes.set(title, ids);
    });
    const publishedTitleSet = new Set(publishedBooks.map(b => (b.title || "").trim().toLowerCase()));
    drafts.forEach(d => {
      if (d.publishedAt) return;
      const normalizedTitle = (d.title || "").trim().toLowerCase();
      if (!normalizedTitle) return;
      if (publishedTitleSet.has(normalizedTitle) && !dupes.has(normalizedTitle)) {
        dupes.set(normalizedTitle, [d.id]);
      }
    });
    return dupes;
  }, [drafts, publishedBooks]);
  
  // Count missing covers (includes title placers)
  const missingCoverCount = drafts.filter(d => !coverReviewHasImage(d)).length;
  const titlePlacerCount = drafts.filter(isTitlePlacerDraft).length;

  const classicGenres = ["Classic Literature", "Classic Adventure", "Classic Drama", "Classic Epic", "Classic Fantasy", "Classic Horror", "Classic Mystery", "Classic Philosophy", "Classic Romance", "Classic Science Fiction"];
  
  // Filter drafts based on current view mode
  // Default: show ALL ebooks (with or without covers) until user decides they're complete
  const draftsForReview = useMemo(() => {
    let filtered = drafts;
    if (!showClassics) {
      filtered = filtered.filter(d => !classicGenres.includes(d.genre));
    }
    if (coverFilter === "published") {
      filtered = filtered.filter(d => d.publishedAt);
    } else if (coverFilter === "unpublished") {
      filtered = filtered.filter(d => !d.publishedAt);
    }
    if (showMissingCovers) {
      filtered = filtered.filter(d => !coverReviewHasImage(d));
    }
    return filtered;
  }, [drafts, showMissingCovers, coverFilter, showClassics]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return draftsForReview.filter(d => d.title.toLowerCase().includes(q) || d.genre?.toLowerCase().includes(q) || String(d.id) === q.trim());
  }, [searchQuery, draftsForReview]);

  const selectedDraft = drafts.find(d => d.id === selectedDraftId);

  // Style names for grouping display
  const allStyleNames: Record<string, string> = {
    "replit-cinematic": "Classic Library 239 (Original)",
    "dalle3-vivid": "DALL-E 3 Vivid",
    "cinematic-openai": "Cinematic via OpenAI",
    "artistic-painterly": "Artistic Painterly",
    "artistic-compact": "Artistic Compact",
    "vivid-atmospheric": "Vivid Atmospheric",
    "standalone-scenes": "Standalone Scenes",
    "reference-inspired": "Reference Inspired",
    "vivid-painterly-pro": "Vivid Painterly Pro",
    "atmospheric-cinema": "Atmospheric Cinema",
    "experimental-239": "Experimental 239",
    "classic-239": "Classic 239 (CGI/Glowing)",
    "classic-library-239": "Replit Cinematic",
    "test-style-a": "Test A (Jan 27)",
    "test-style-b": "Test B (Jan 17)",
    "test-style-c": "Test C (Jan 18)",
    "test-style-d": "Test D (Jan 28)",
    "test-style-e": "Test E (Jan 28)",
    "test-style-f": "Test F (Jan 26)",
    "test-style-g": "Test G (Jan 26)",
    "test-style-h": "Test H (Jan 27)"
  };

  // All available styles with their visual config
  const allStyles = [
    { id: "classic-library-239", emoji: "📚", gradient: "from-amber-900 to-red-950", color: "amber" },
    { id: "cinematic-openai", emoji: "✨", gradient: "from-amber-800 to-amber-950", color: "green" },
    { id: "replit-cinematic", emoji: "🎬", gradient: "from-blue-700 to-blue-900", color: "blue" },
    { id: "dalle3-vivid", emoji: "🖼️", gradient: "from-purple-700 to-purple-900", color: "blue" },
    { id: "artistic-painterly", emoji: "🎨", gradient: "from-purple-800 to-purple-950", color: "purple" },
    { id: "artistic-compact", emoji: "✨", gradient: "from-pink-700 to-pink-900", color: "pink" },
    { id: "vivid-atmospheric", emoji: "🌅", gradient: "from-emerald-700 to-teal-900", color: "emerald" },
    { id: "standalone-scenes", emoji: "🏞️", gradient: "from-cyan-700 to-blue-900", color: "cyan" },
    { id: "vivid-painterly-pro", emoji: "🎨", gradient: "from-yellow-600 to-amber-800", color: "yellow" },
    { id: "atmospheric-cinema", emoji: "🎬", gradient: "from-orange-600 to-red-800", color: "orange" },
    { id: "classic-239", emoji: "★", gradient: "from-amber-600 to-orange-800", color: "amber" },
    { id: "experimental-239", emoji: "🔬", gradient: "from-indigo-600 to-violet-800", color: "indigo" },
    // Test styles for identifying original 239-253 cover code
    { id: "test-style-a", emoji: "🅰️", gradient: "from-slate-600 to-slate-800", color: "slate" },
    { id: "test-style-b", emoji: "🅱️", gradient: "from-zinc-600 to-zinc-800", color: "zinc" },
    { id: "test-style-c", emoji: "©️", gradient: "from-stone-600 to-stone-800", color: "stone" },
    { id: "test-style-d", emoji: "🇩", gradient: "from-neutral-600 to-neutral-800", color: "neutral" },
    { id: "test-style-e", emoji: "🇪", gradient: "from-gray-600 to-gray-800", color: "gray" },
    { id: "test-style-f", emoji: "🇫", gradient: "from-red-600 to-red-800", color: "red" },
    { id: "test-style-g", emoji: "🇬", gradient: "from-green-600 to-green-800", color: "green" },
    { id: "test-style-h", emoji: "🇭", gradient: "from-blue-600 to-blue-800", color: "blue" },
  ];

  // Group drafts by coverStyleId
  const groupedDrafts = useMemo(() => {
    const groups: Record<string, DraftEbook[]> = {};
    const ungrouped: DraftEbook[] = [];
    
    draftsForReview.forEach(draft => {
      if (draft.coverStyleId && draft.coverStyleId !== "") {
        if (!groups[draft.coverStyleId]) {
          groups[draft.coverStyleId] = [];
        }
        groups[draft.coverStyleId].push(draft);
      } else {
        ungrouped.push(draft);
      }
    });
    
    // Create entries for ALL styles (even empty ones) sorted by count desc
    const allGroupEntries = allStyles.map(style => ({
      styleId: style.id,
      drafts: groups[style.id] || [],
      config: style
    })).sort((a, b) => b.drafts.length - a.drafts.length);
    
    return { allGroups: allGroupEntries, ungrouped };
  }, [draftsForReview]);

  useEffect(() => {
    if (!expandedSectionsInitialized && groupedDrafts) {
      const firstNonEmpty = groupedDrafts.allGroups.find(g => g.drafts.length > 0);
      if (firstNonEmpty) {
        setExpandedSections(new Set([firstNonEmpty.styleId]));
      }
      setExpandedSectionsInitialized(true);
    }
  }, [groupedDrafts, expandedSectionsInitialized]);

  const toggleSectionExpanded = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 px-3 py-4">
      <input
        ref={swapFileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleSwapFile}
        data-testid="input-swap-cover-file"
      />
      <div className="w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="text-gray-700 hover:text-gray-900" data-testid="link-home">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
            <Link href="/catalog">
              <Button variant="outline" size="sm" className="text-gray-700 hover:text-gray-900" data-testid="link-store">
                <BookOpen className="w-4 h-4 mr-2" />
                Catalog
              </Button>
            </Link>
            <Link href="/content-studio">
              <Button variant="outline" size="sm" className="text-gray-700 hover:text-gray-900" data-testid="link-content-studio">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Content Studio
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Cover Review</h1>
          </div>

          <div className="relative flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by title, genre, or ID..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); }}
                className="pl-8 pr-8 py-2 text-sm text-gray-900 bg-white border-2 border-gray-300 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 shadow-sm"
                data-testid="input-search-covers"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-500 hover:text-gray-800" />
                </button>
              )}
            </div>
            {searchQuery && (
              <span className="text-sm font-medium text-amber-300 whitespace-nowrap">
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            {autoRefresh && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Auto-refreshing...
              </div>
            )}
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] })}
              data-testid="button-manual-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => { setShowResearchDialog(true); setLastResearchResult(null); }}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="button-ai-research-titles"
            >
              <Lightbulb className="w-4 h-4 mr-1" />
              AI Research Titles
            </Button>
            {titlePlacerCount > 0 && !showMissingCovers && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExpandedSections((prev) => new Set([...prev, "__placers__"]));
                  setTimeout(() => {
                    document.getElementById("section-title-placers")?.scrollIntoView({ behavior: "smooth", block: "end" });
                  }, 100);
                }}
                className="border-violet-400 text-violet-700 hover:bg-violet-50"
                data-testid="button-jump-to-placers"
              >
                <Lightbulb className="w-4 h-4 mr-1" />
                Title Placers ({titlePlacerCount})
              </Button>
            )}
            {missingCoverCount > 0 && (
              <Button
                variant={showMissingCovers ? "default" : "outline"}
                size="sm"
                onClick={() => { setShowMissingCovers(!showMissingCovers); }}
                className={showMissingCovers ? "bg-orange-600 hover:bg-orange-700" : "border-orange-400 text-orange-700 hover:bg-orange-50"}
                data-testid="button-show-missing"
              >
                <Image className="w-4 h-4 mr-1" />
                Missing Covers ({missingCoverCount})
              </Button>
            )}
            {duplicateTitles.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setChosenDuplicates(new Map()); setShowDuplicatesPopup(true); }}
                className="border-purple-400 text-purple-700 hover:bg-purple-50"
                data-testid="button-show-duplicates"
              >
                <BookOpen className="w-4 h-4 mr-1" />
                Duplicates ({duplicateTitles.size} titles)
              </Button>
            )}
            <Button
              variant={showClassics ? "default" : "outline"}
              size="sm"
              onClick={() => setShowClassics(!showClassics)}
              className={showClassics ? "bg-blue-600 hover:bg-blue-700" : "border-blue-400 text-blue-700 hover:bg-blue-50"}
              data-testid="button-toggle-classics"
            >
              <BookOpen className="w-4 h-4 mr-1" />
              {showClassics ? "Classics Shown" : "Include Classics"}
            </Button>
            <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-0.5" data-testid="filter-published-status">
              {([["all", "All"], ["unpublished", "Unpublished"], ["published", "Published"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setCoverFilter(val)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    coverFilter === val
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={showCleanBackgrounds}
                onCheckedChange={setShowCleanBackgrounds}
                data-testid="switch-view-mode"
              />
              <Label className="text-sm text-black">
                {showCleanBackgrounds ? "Showing Clean Backgrounds" : "Showing Covers with Text"}
              </Label>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <div className="flex items-center gap-3 flex-wrap bg-gray-50 p-3 rounded-lg border">
          <span className="text-sm text-gray-600 font-medium">
            {selectedDraftIds.size} selected
          </span>
          {selectedDraftIds.size > 0 && (() => {
            const selectedPublished = [...selectedDraftIds].filter(id => {
              const d = drafts.find(dr => dr.id === id);
              return d && d.publishedAt;
            });
            if (selectedPublished.length === 0) return null;
            return (
              <Button
                variant="outline"
                size="sm"
                disabled={syncingCoverIds.size > 0}
                onClick={async () => {
                  for (const draftId of selectedPublished) {
                    setSyncingCoverIds(prev => new Set(prev).add(draftId));
                    try {
                      const res = await apiRequest("POST", `/api/content-studio/sync-cover-to-published/${draftId}`);
                      const data = await res.json();
                      if (data.success) {
                        toast({ title: "Cover Updated", description: `Pushed cover to ${data.updatedCount} published book(s)` });
                      }
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message || "Failed to push cover", variant: "destructive" });
                    } finally {
                      setSyncingCoverIds(prev => {
                        const next = new Set(prev);
                        next.delete(draftId);
                        return next;
                      });
                    }
                  }
                }}
                className="border-green-500 text-green-700 hover:bg-green-50"
                data-testid="button-push-cover-to-store"
              >
                {syncingCoverIds.size > 0 ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1" />
                )}
                Push Cover to Store ({selectedPublished.length})
              </Button>
            );
          })()}
          {selectedDraftIds.size === 2 && (
            <Button
              variant="outline"
              size="sm"
              className="border-purple-400 text-purple-700 hover:bg-purple-50"
              data-testid="button-switch-covers"
              disabled={swapBetweenMutation.isPending}
              onClick={() => {
                const ids = Array.from(selectedDraftIds);
                const draftA = drafts.find(d => d.id === ids[0]);
                const draftB = drafts.find(d => d.id === ids[1]);
                if (draftA && draftB) {
                  if (confirm(`Switch covers between "${draftA.title}" and "${draftB.title}"?`)) {
                    swapBetweenMutation.mutate({ draftIdA: ids[0], draftIdB: ids[1] });
                  }
                }
              }}
            >
              {swapBetweenMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Replace className="w-4 h-4 mr-1" />
              )}
              Switch Covers
            </Button>
          )}
          <div className="h-4 w-px bg-gray-300" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                data-testid="button-download-covers-zip"
              >
                <Download className="w-4 h-4 mr-1" />
                Download {selectedDraftIds.size > 0 ? `(${selectedDraftIds.size})` : "All"}
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => downloadSelectedCoversZip("png")} data-testid="download-png">
                PNG (High Quality)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadSelectedCoversZip("jpg")} data-testid="download-jpg">
                JPG (Smaller Size)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadSelectedCoversZip("webp")} data-testid="download-webp">
                WebP (Web Optimized)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadSelectedCoversZip("epub")} data-testid="download-epub">
                EPUB (Ebook Format)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="default"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            data-testid="button-upload-covers-zip"
          >
            {isUploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Upload Covers ZIP
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".zip"
            onChange={handleUploadCoversZip}
            className="hidden"
          />
          {selectedDraftIds.size > 0 && (
            <>
              <div className="h-4 w-px bg-gray-300" />
              <Button
                variant="destructive"
                size="sm"
                disabled={bulkDeleting}
                onClick={bulkDeleteEbooks}
                data-testid="button-bulk-delete-ebooks"
              >
                {bulkDeleting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                Delete {selectedDraftIds.size} Ebook{selectedDraftIds.size !== 1 ? "s" : ""}
              </Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Settings */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Typography
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Title Font</Label>
                  <Select value={selectedTitleFont} onValueChange={setSelectedTitleFont}>
                    <SelectTrigger className="h-9" data-testid="select-title-font">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions?.titleFonts?.map((font) => (
                        <SelectItem key={font} value={font}>{font}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Author Font</Label>
                  <Select value={selectedAuthorFont} onValueChange={setSelectedAuthorFont}>
                    <SelectTrigger className="h-9" data-testid="select-author-font">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions?.authorFonts?.map((font) => (
                        <SelectItem key={font} value={font}>{font}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Effect</Label>
                  <Select value={selectedEffect} onValueChange={setSelectedEffect}>
                    <SelectTrigger className="h-9" data-testid="select-effect">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions?.effects?.map((effect) => (
                        <SelectItem key={effect} value={effect}>
                          {formatEffectName(effect)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Position</Label>
                  <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                    <SelectTrigger className="h-9" data-testid="select-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions?.positions?.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {formatPositionName(pos)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Title Case</Label>
                  <Select value={selectedTitleCase} onValueChange={setSelectedTitleCase}>
                    <SelectTrigger className="h-9" data-testid="select-title-case">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="titlecase">Title Case</SelectItem>
                      <SelectItem value="uppercase">UPPERCASE</SelectItem>
                      <SelectItem value="original">Original</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* AI Style Vault - Shows 3-4 style choices for selected cover */}
            {selectedDraftId && (
              <Card className="border-purple-200 bg-purple-50/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-purple-900">
                    <Sparkles className="w-4 h-4" />
                    AI Style Vault
                  </CardTitle>
                  <p className="text-xs text-purple-700">
                    {typographyVault.has(selectedDraftId) 
                      ? `${typographyVault.get(selectedDraftId)?.styleOptions.length || 0} artistic styles`
                      : "Click generate to create style options"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {loadingVaultFor.has(selectedDraftId) ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600 mr-2" />
                      <span className="text-sm text-purple-700">AI designing styles...</span>
                    </div>
                  ) : typographyVault.has(selectedDraftId) ? (
                    <div className="space-y-2">
                      {typographyVault.get(selectedDraftId)?.styleOptions.map((style) => {
                        const isSelected = selectedStyleForDraft.get(selectedDraftId) === style.id;
                        return (
                          <div
                            key={style.id}
                            onClick={() => applyVaultStyle(selectedDraftId, style.id)}
                            className={`p-3 rounded-lg cursor-pointer border-2 transition-all ${
                              isSelected 
                                ? "border-purple-500 bg-purple-100" 
                                : "border-gray-200 bg-white hover:border-purple-300"
                            }`}
                            data-testid={`style-option-${style.id}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{style.name}</span>
                              {isSelected && <Check className="w-4 h-4 text-purple-600" />}
                            </div>
                            <p className="text-xs text-gray-500 mb-2 italic">{style.aesthetic}</p>
                            <div className="flex gap-2 items-center text-xs">
                              <div 
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: style.titleColor }}
                                title={`Title: ${style.titleColor}`}
                              />
                              <span className="text-gray-600 truncate">{style.titleFont}</span>
                            </div>
                            {isSelected && (
                              <p className="text-xs text-gray-500 mt-2 line-clamp-2">{style.reasoning}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => generateTypographyFromVault(selectedDraftId)}
                      data-testid="button-generate-vault-styles"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate AI Styles
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Colors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Color Preset</Label>
                  <Select value={selectedColorPreset} onValueChange={setSelectedColorPreset}>
                    <SelectTrigger className="h-9" data-testid="select-color-preset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontOptions?.colorPresets?.map((preset) => (
                        <SelectItem key={preset.name} value={preset.name}>
                          <div className="flex items-center gap-2">
                            {preset.titleColor && (
                              <div 
                                className="w-3 h-3 rounded-full border" 
                                style={{ backgroundColor: preset.titleColor }}
                              />
                            )}
                            {preset.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedColorPreset === "Custom" && (
                  <>
                    <div>
                      <Label className="text-xs">Title Color</Label>
                      <input
                        type="color"
                        value={customTitleColor || "#FFFFFF"}
                        onChange={(e) => setCustomTitleColor(e.target.value)}
                        className="w-full h-8 rounded cursor-pointer"
                        data-testid="input-title-color"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Author Color</Label>
                      <input
                        type="color"
                        value={customAuthorColor || "#CCCCCC"}
                        onChange={(e) => setCustomAuthorColor(e.target.value)}
                        className="w-full h-8 rounded cursor-pointer"
                        data-testid="input-author-color"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Outline Color</Label>
                      <input
                        type="color"
                        value={customOutlineColor || "#000000"}
                        onChange={(e) => setCustomOutlineColor(e.target.value)}
                        className="w-full h-8 rounded cursor-pointer"
                        data-testid="input-outline-color"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={generatePreview}
                  disabled={!selectedDraftId || isGeneratingPreview}
                  data-testid="button-preview"
                >
                  {isGeneratingPreview ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview Selected
                    </>
                  )}
                </Button>

                <div className="border-t pt-3 mt-3">
                  <Label className="text-xs mb-2 block">AI Style Selection {selectedModelStyleIds.size > 1 && <span className="text-purple-600 font-semibold">({selectedModelStyleIds.size} styles selected)</span>}</Label>
                  <div className="space-y-2 mb-3">
                    <button
                      onClick={() => toggleStyleSelection("cinematic-openai")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("cinematic-openai")
                          ? "border-green-500 bg-green-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-cinematic-openai"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-800 to-amber-950 rounded flex items-center justify-center">
                          <span className="text-amber-200 text-lg">✨</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-green-400">Cinematic via OpenAI</p>
                          <p className="text-[10px] text-gray-400">Same 239-253 style, uses YOUR API key</p>
                          <p className="text-[9px] text-green-600">Recommended - bypasses Replit limits</p>
                        </div>
                      </div>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => toggleStyleSelection("replit-cinematic")}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          selectedModelStyleIds.has("replit-cinematic")
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-gray-600 hover:border-gray-400"
                        }`}
                        data-testid="button-style-replit"
                      >
                        <img
                          src="/uploads/covers/style-preview-replit.png"
                          alt="Classic Library 239 (Original)"
                          className="w-full h-12 object-cover rounded mb-1"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <p className="text-xs font-medium">Classic Library 239 (Original)</p>
                        <p className="text-[10px] text-gray-400">gpt-image-1 (Replit budget)</p>
                      </button>
                      <button
                        onClick={() => toggleStyleSelection("dalle3-vivid")}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          selectedModelStyleIds.has("dalle3-vivid")
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-gray-600 hover:border-gray-400"
                        }`}
                        data-testid="button-style-dalle3"
                      >
                        <img
                          src="/uploads/covers/style-preview-dalle3.png"
                          alt="DALL-E 3 Vivid"
                          className="w-full h-12 object-cover rounded mb-1"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <p className="text-xs font-medium">DALL-E 3 Vivid</p>
                        <p className="text-[10px] text-gray-400">Modern photorealistic</p>
                      </button>
                    </div>
                    <button
                      onClick={() => toggleStyleSelection("artistic-painterly")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("artistic-painterly")
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-artistic-painterly"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-800 to-purple-950 rounded flex items-center justify-center">
                          <span className="text-purple-200 text-lg">🎨</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-purple-400">Artistic Painterly</p>
                          <p className="text-[10px] text-gray-400">Rich detail prompts (DALL-E 3)</p>
                          <p className="text-[9px] text-purple-600">Pre-selected random elements</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => toggleStyleSelection("artistic-compact")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("artistic-compact")
                          ? "border-pink-500 bg-pink-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-artistic-compact"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-pink-700 to-pink-900 rounded flex items-center justify-center">
                          <span className="text-pink-200 text-lg">✨</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-pink-400">Artistic Compact</p>
                          <p className="text-[10px] text-gray-400">Concise focused prompts (DALL-E 3)</p>
                          <p className="text-[9px] text-pink-600">Minimal prompt, max impact</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => toggleStyleSelection("vivid-atmospheric")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("vivid-atmospheric")
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-vivid-atmospheric"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-700 to-teal-900 rounded flex items-center justify-center">
                          <span className="text-emerald-200 text-lg">🌅</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-emerald-400">Vivid Atmospheric</p>
                          <p className="text-[10px] text-gray-400">gpt-image-1 atmospheric scenes</p>
                          <p className="text-[9px] text-emerald-600">Moody, dramatic scene imagery</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => toggleStyleSelection("standalone-scenes")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("standalone-scenes")
                          ? "border-cyan-500 bg-cyan-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-standalone-scenes"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-700 to-blue-900 rounded flex items-center justify-center">
                          <span className="text-cyan-200 text-lg">🏞️</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-cyan-400">Standalone Scenes</p>
                          <p className="text-[10px] text-gray-400">gpt-image-1 pure imagery</p>
                          <p className="text-[9px] text-cyan-600">Beautiful scenes, no book design</p>
                        </div>
                      </div>
                    </button>
                    
                    {/* FULL AI AUTO - Complete AI automation */}
                    <div className="border-t border-emerald-700/50 pt-3 mt-1">
                      <p className="text-xs text-emerald-400 mb-2 font-medium">FULL AI AUTO - AI Makes All Decisions</p>
                    </div>
                    
                    <button
                      onClick={() => toggleStyleSelection("full-ai-auto")}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("full-ai-auto")
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-emerald-600/50 hover:border-emerald-400 bg-emerald-900/20"
                      }`}
                      data-testid="button-style-full-ai-auto"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-lg flex items-center justify-center">
                          <span className="text-white text-2xl">🤖</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-emerald-400">Full AI Auto</p>
                          <p className="text-[10px] text-gray-300">AI chooses best style, generates cover, applies typography</p>
                          <p className="text-[9px] text-emerald-600">One click = complete AI-driven cover creation</p>
                        </div>
                      </div>
                    </button>
                    
                    {/* NEW ENHANCED STYLES - Based on proven covers 239-253 */}
                    <div className="border-t border-yellow-700/50 pt-3 mt-1">
                      <p className="text-xs text-yellow-400 mb-2 font-medium">NEW: Proven Vivid Styles (from covers 239-253)</p>
                    </div>
                    
                    {/* Vivid Painterly Pro - DALL-E 3 with AI Creative Director */}
                    <button
                      onClick={() => toggleStyleSelection("vivid-painterly-pro")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("vivid-painterly-pro")
                          ? "border-yellow-500 bg-yellow-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-vivid-painterly-pro"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-600 to-amber-800 rounded flex items-center justify-center">
                          <span className="text-yellow-200 text-lg">🎨</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-yellow-400">Vivid Painterly Pro</p>
                          <p className="text-[10px] text-gray-400">DALL-E 3 + AI Creative Director</p>
                          <p className="text-[9px] text-yellow-600">AI brainstorms unique visuals per book</p>
                        </div>
                      </div>
                    </button>
                    
                    {/* Atmospheric Cinema - gpt-image-1 with AI Creative Director */}
                    <button
                      onClick={() => toggleStyleSelection("atmospheric-cinema")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("atmospheric-cinema")
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-atmospheric-cinema"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-600 to-red-800 rounded flex items-center justify-center">
                          <span className="text-orange-200 text-lg">🎬</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-orange-400">Atmospheric Cinema</p>
                          <p className="text-[10px] text-gray-400">gpt-image-1 + AI Creative Director</p>
                          <p className="text-[9px] text-orange-600">AI crafts unique cinematic concepts</p>
                        </div>
                      </div>
                    </button>
                    
                    {/* Replit Cinematic - Original covers 239-253 style */}
                    <button
                      onClick={() => toggleStyleSelection("classic-library-239")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("classic-library-239")
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-classic-library-239"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-900 to-red-950 rounded flex items-center justify-center">
                          <span className="text-amber-100 text-lg">📚</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-amber-400">Replit Cinematic</p>
                          <p className="text-[10px] text-gray-400">Original 239-253 dark academia style</p>
                          <p className="text-[9px] text-amber-600">Burgundy, gold, vintage library feel</p>
                        </div>
                      </div>
                    </button>
                    
                    {/* Classic 239 - Exact style from 239-253 covers with Replit AI */}
                    <button
                      onClick={() => toggleStyleSelection("classic-239")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("classic-239")
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-classic-239"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-orange-800 rounded flex items-center justify-center">
                          <span className="text-amber-100 text-lg">★</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-amber-400">Classic 239 (Replit AI)</p>
                          <p className="text-[10px] text-gray-400">EXACT 239-253 style: CGI, glowing, bright</p>
                          <p className="text-[9px] text-amber-600">Title-literal, rim lighting, volumetric rays</p>
                        </div>
                      </div>
                    </button>
                    
                    {/* Experimental 239 - Reverse-engineered from user's best covers */}
                    <button
                      onClick={() => toggleStyleSelection("experimental-239")}
                      className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                        selectedModelStyleIds.has("experimental-239")
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-gray-600 hover:border-gray-400"
                      }`}
                      data-testid="button-style-experimental-239"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-800 rounded flex items-center justify-center">
                          <span className="text-emerald-200 text-lg">🧪</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-emerald-400">Experimental 239</p>
                          <p className="text-[10px] text-gray-400">Reverse-engineered from your best covers</p>
                          <p className="text-[9px] text-emerald-600">Title-literal CGI cinematic style</p>
                        </div>
                      </div>
                    </button>
                    
                    {/* ============= TEMPORARY TEST BUTTONS ============= */}
                    <div className="border-t border-yellow-700 pt-3 mt-3 bg-yellow-900/20 rounded-lg p-2">
                      <p className="text-xs text-yellow-400 font-bold mb-2">🧪 TEST STYLES (Finding Original)</p>
                      <div className="space-y-2">
                        <button
                          onClick={() => toggleStyleSelection("test-style-a")}
                          className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                            selectedModelStyleIds.has("test-style-a")
                              ? "border-yellow-500 bg-yellow-500/10"
                              : "border-yellow-700 hover:border-yellow-500"
                          }`}
                          data-testid="button-test-style-a"
                        >
                          <p className="text-xs font-medium text-yellow-300">Test A: Jan 27 (5777f15)</p>
                          <p className="text-[9px] text-yellow-500">"Professional cinematic artwork" - 10 colors, 5 styles</p>
                        </button>
                        
                        <button
                          onClick={() => toggleStyleSelection("test-style-b")}
                          className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                            selectedModelStyleIds.has("test-style-b")
                              ? "border-yellow-500 bg-yellow-500/10"
                              : "border-yellow-700 hover:border-yellow-500"
                          }`}
                          data-testid="button-test-style-b"
                        >
                          <p className="text-xs font-medium text-yellow-300">Test B: Jan 17 (49bfc2d)</p>
                          <p className="text-[9px] text-yellow-500">"Professional ebook cover design" - 15 colors, 15 styles</p>
                        </button>
                        
                        <button
                          onClick={() => toggleStyleSelection("test-style-c")}
                          className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                            selectedModelStyleIds.has("test-style-c")
                              ? "border-yellow-500 bg-yellow-500/10"
                              : "border-yellow-700 hover:border-yellow-500"
                          }`}
                          data-testid="button-test-style-c"
                        >
                          <p className="text-xs font-medium text-yellow-300">Test C: Jan 18 (a0c793e)</p>
                          <p className="text-[9px] text-yellow-500">Enhanced - 30 colors, 25 styles, 20 compositions</p>
                        </button>
                        
                        <button
                          onClick={() => toggleStyleSelection("test-style-d")}
                          className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                            selectedModelStyleIds.has("test-style-d")
                              ? "border-orange-500 bg-orange-500/10"
                              : "border-orange-700 hover:border-orange-500"
                          }`}
                          data-testid="button-test-style-d"
                        >
                          <p className="text-xs font-medium text-orange-300">Test D: Jan 28 (c280a4e)</p>
                          <p className="text-[9px] text-orange-500">Vivid Painterly Pro - detailed focal subjects, symbols</p>
                        </button>
                        
                        <button
                          onClick={() => toggleStyleSelection("test-style-e")}
                          className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                            selectedModelStyleIds.has("test-style-e")
                              ? "border-orange-500 bg-orange-500/10"
                              : "border-orange-700 hover:border-orange-500"
                          }`}
                          data-testid="button-test-style-e"
                        >
                          <p className="text-xs font-medium text-orange-300">Test E: Jan 28 (61544e9)</p>
                          <p className="text-[9px] text-orange-500">AI Creative Director - artistic influences, metaphors</p>
                        </button>
                        
                        <button
                          onClick={() => toggleStyleSelection("test-style-f")}
                          className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                            selectedModelStyleIds.has("test-style-f")
                              ? "border-pink-500 bg-pink-500/10"
                              : "border-pink-700 hover:border-pink-500"
                          }`}
                          data-testid="button-test-style-f"
                        >
                          <p className="text-xs font-medium text-pink-300">Test F: Jan 26 (c174fa1)</p>
                          <p className="text-[9px] text-pink-500">Photography - National Geographic/Vogue style</p>
                        </button>
                        
                        <button
                          onClick={() => toggleStyleSelection("test-style-g")}
                          className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                            selectedModelStyleIds.has("test-style-g")
                              ? "border-pink-500 bg-pink-500/10"
                              : "border-pink-700 hover:border-pink-500"
                          }`}
                          data-testid="button-test-style-g"
                        >
                          <p className="text-xs font-medium text-pink-300">Test G: Jan 26 (42e4d7a)</p>
                          <p className="text-[9px] text-pink-500">8K Photorealistic - masterpiece quality</p>
                        </button>
                        
                        <button
                          onClick={() => toggleStyleSelection("test-style-h")}
                          className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                            selectedModelStyleIds.has("test-style-h")
                              ? "border-pink-500 bg-pink-500/10"
                              : "border-pink-700 hover:border-pink-500"
                          }`}
                          data-testid="button-test-style-h"
                        >
                          <p className="text-xs font-medium text-pink-300">Test H: Jan 27 (0784a94)</p>
                          <p className="text-[9px] text-pink-500">Professional artwork - realistic humans, 3D depth</p>
                        </button>
                      </div>
                    </div>
                    
                    {/* Reference Inspired Style */}
                    <div className="border-t border-gray-700 pt-3 mt-1">
                      <p className="text-xs text-gray-400 mb-2">Upload Reference Image</p>
                      <input
                        type="file"
                        ref={referenceInputRef}
                        onChange={handleReferenceUpload}
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        data-testid="input-reference-upload"
                      />
                      {referenceAnalysis.hasReference ? (
                        <button
                          onClick={() => toggleStyleSelection("reference-inspired")}
                          className={`w-full p-2 rounded-lg border-2 transition-all text-left ${
                            selectedModelStyleIds.has("reference-inspired")
                              ? "border-pink-500 bg-pink-500/10"
                              : "border-gray-600 hover:border-gray-400"
                          }`}
                          data-testid="button-style-reference"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-12 bg-gradient-to-br from-pink-700 to-rose-900 rounded flex items-center justify-center">
                              <span className="text-pink-200 text-lg">📷</span>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-pink-400">Reference Inspired</p>
                              <p className="text-[10px] text-gray-400 truncate">{referenceAnalysis.analysis?.style}</p>
                              <p className="text-[9px] text-pink-600 truncate">{referenceAnalysis.analysis?.mood}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); clearReference(); }}
                              className="text-xs h-6 px-2"
                            >
                              Clear
                            </Button>
                          </div>
                        </button>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => referenceInputRef.current?.click()}
                          disabled={isUploadingReference}
                          data-testid="button-upload-reference"
                        >
                          {isUploadingReference ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Reference Photo
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  variant="default"
                  onClick={regenerateSelectedBackgrounds}
                  disabled={selectedDraftIds.size === 0 || isRegeneratingSelected}
                  data-testid="button-regenerate-selected"
                >
                  {isRegeneratingSelected ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {regenProgress || "Starting..."}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate Selected ({selectedDraftIds.size}){selectedModelStyleIds.size > 1 ? ` × ${selectedModelStyleIds.size} styles` : ""}
                    </>
                  )}
                </Button>

                <div className="flex items-center gap-2 w-full px-1">
                  <button
                    onClick={() => setTitleEmbedSync(!titleEmbedSync)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${titleEmbedSync ? 'bg-amber-500' : 'bg-gray-600'}`}
                    data-testid="toggle-title-embed-sync"
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${titleEmbedSync ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-xs text-gray-400">
                    Title Embed Sync {titleEmbedSync && <span className="text-amber-400 font-medium">(ON)</span>}
                  </span>
                </div>

                <Button
                  className="w-full"
                  onClick={() => selectedDraftId && finalizeSingleCover(selectedDraftId)}
                  disabled={!selectedDraftId || finalizingIds.has(selectedDraftId)}
                  data-testid="button-finalize-one"
                >
                  {selectedDraftId && finalizingIds.has(selectedDraftId) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Finalize Selected
                    </>
                  )}
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => selectedDraftId && applyTitleBar(selectedDraftId)}
                  disabled={!selectedDraftId || titleBarIds.has(selectedDraftId)}
                  data-testid="button-title-bar-one"
                >
                  {selectedDraftId && titleBarIds.has(selectedDraftId) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Type className="w-4 h-4 mr-2" />
                      Apply Title Bar
                    </>
                  )}
                </Button>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    if (selectedDraftIds.size > 1) {
                      batchAiTitleOverlay();
                    } else if (selectedDraftId) {
                      handleAiTitleOverlay(selectedDraftId);
                    }
                  }}
                  disabled={(!selectedDraftId && selectedDraftIds.size === 0) || batchAiOverlayPending || (selectedDraftId && selectedDraftIds.size <= 1 ? aiTitleOverlayLoading.has(selectedDraftId || 0) : false)}
                  data-testid="button-ai-title-overlay"
                >
                  {batchAiOverlayPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      AI Overlay ({selectedDraftIds.size})...
                    </>
                  ) : selectedDraftId && aiTitleOverlayLoading.has(selectedDraftId) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      AI Adding Title...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI Title Overlay{selectedDraftIds.size > 1 ? ` (${selectedDraftIds.size})` : ''}
                    </>
                  )}
                </Button>

                <Button
                  className="w-full"
                  variant="ghost"
                  size="sm"
                  onClick={() => selectedDraftId && handleRemoveTitle(selectedDraftId)}
                  disabled={!selectedDraftId || removingTitleIds.has(selectedDraftId || 0) || (() => {
                    const d = draftsForReview.find(d => d.id === selectedDraftId);
                    if (!d) return true;
                    if (d.coverUrl) return false;
                    const bg = d.backgroundUrl || "";
                    return !(bg.includes("twotone") || bg.includes("ai-cover") || bg.includes("ai-overlay"));
                  })()}
                  data-testid="button-remove-title"
                >
                  {selectedDraftId && removingTitleIds.has(selectedDraftId) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove Title
                    </>
                  )}
                </Button>
                
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs text-gray-500 mb-2">Batch Actions</p>
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={regenerateAllBackgrounds}
                      disabled={isRegeneratingAll || draftsForReview.length === 0}
                      data-testid="button-regenerate-all"
                    >
                      {isRegeneratingAll ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Regenerating All...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          New Backgrounds (All {draftsForReview.length})
                        </>
                      )}
                    </Button>

                    <Button
                      className="w-full"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAllTitles}
                      disabled={isRemovingAllTitles}
                      data-testid="button-remove-all-titles"
                    >
                      {isRemovingAllTitles ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Removing All Titles...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove All Title Bars
                        </>
                      )}
                    </Button>

                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => batchFinalizeMutation.mutate()}
                      disabled={batchFinalizeMutation.isPending || draftsForReview.length === 0}
                      data-testid="button-batch-finalize"
                    >
                      {batchFinalizeMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Applying to All...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Finalize All ({draftsForReview.length})
                        </>
                      )}
                    </Button>

                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={batchApplyTitleBar}
                      disabled={batchTitleBarPending || selectedDraftIds.size === 0}
                      data-testid="button-batch-title-bar"
                    >
                      {batchTitleBarPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Applying Title Bars...
                        </>
                      ) : (
                        <>
                          <Type className="w-4 h-4 mr-2" />
                          Title Bar ({selectedDraftIds.size > 0 ? `Selected ${selectedDraftIds.size}` : "Select covers"})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cover Grid */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      {showCleanBackgrounds ? "Clean Backgrounds" : "Covers with Text"} ({draftsForReview.length})
                      {selectedDraftIds.size > 0 && (
                        <span className="text-sm font-normal text-blue-600">
                          ({selectedDraftIds.size} selected)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={selectAll}
                      data-testid="button-select-all"
                    >
                      <CheckSquare className="w-3 h-3 mr-1" />
                      Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={clearSelection}
                      disabled={selectedDraftIds.size === 0}
                      data-testid="button-clear-selection"
                    >
                      <Square className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                    <div className="h-6 w-px bg-gray-300" />
                    <Button 
                      variant={textPreviewIds.size > 0 ? "default" : "outline"}
                      size="sm" 
                      disabled={isAnalyzing}
                      onClick={() => {
                        const targetIds = selectedDraftIds.size > 0 
                          ? Array.from(selectedDraftIds) 
                          : draftsForReview.map(d => d.id);
                        analyzeAndShowText(targetIds);
                      }}
                      data-testid="button-preview-text"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Type className="w-3 h-3 mr-1" />
                      )}
                      {isAnalyzing ? "Analyzing..." : `AI Show Text ${selectedDraftIds.size > 0 ? `(${selectedDraftIds.size})` : "(All)"}`}
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm" 
                      disabled={isAnalyzing}
                      onClick={() => {
                        const targetIds = selectedDraftIds.size > 0 
                          ? Array.from(selectedDraftIds) 
                          : draftsForReview.map(d => d.id);
                        analyzeAndShowTextReplitStyle(targetIds);
                      }}
                      data-testid="button-preview-text-replit"
                      className="border-purple-400 text-purple-600 hover:bg-purple-50"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Type className="w-3 h-3 mr-1" />
                      )}
                      {isAnalyzing ? "..." : `Replit Style ${selectedDraftIds.size > 0 ? `(${selectedDraftIds.size})` : ""}`}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setTextPreviewIds(new Set())}
                      disabled={textPreviewIds.size === 0}
                      data-testid="button-hide-text"
                    >
                      Hide Text
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      onClick={async () => {
                        const targetIds = selectedDraftIds.size > 0 
                          ? Array.from(selectedDraftIds) 
                          : [];
                        if (targetIds.length === 0) {
                          toast({ title: "Select covers", description: "Please select one or more covers to unfinalize" });
                          return;
                        }
                        try {
                          const response = await fetch("/api/content-studio/unfinalize-covers", {
                            method: "POST",
                            headers: { 
                              "Content-Type": "application/json",
                              "x-admin-token": localStorage.getItem("ebgz_admin_token") || ""
                            },
                            body: JSON.stringify({ draftIds: targetIds })
                          });
                          const result = await response.json();
                          if (result.success) {
                            toast({ title: "Unfinalized", description: result.message });
                            // Refresh the drafts list
                            queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts-with-backgrounds"] });
                          } else {
                            toast({ title: "Error", description: result.error, variant: "destructive" });
                          }
                        } catch (error) {
                          toast({ title: "Error", description: "Failed to unfinalize covers", variant: "destructive" });
                        }
                      }}
                      disabled={selectedDraftIds.size === 0}
                      data-testid="button-unfinalize"
                    >
                      Unfinalize ({selectedDraftIds.size})
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingDrafts ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                  </div>
                ) : draftsForReview.length === 0 ? (
                  <p className="text-gray-500 text-center py-12">
                    No ebooks with backgrounds found.
                  </p>
                ) : searchQuery.trim() ? (
                  /* Search Results View */
                  <div>
                    {searchResults.length === 0 ? (
                      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                        <Search className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                        <p className="text-gray-400 text-lg">No results found for "{searchQuery}"</p>
                        <p className="text-gray-500 text-sm mt-1">Try a different title, genre, or ID</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {searchResults.map((draft) => (
                          <div
                            key={draft.id}
                            className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                              selectedDraftId === draft.id
                                ? "border-green-500 ring-2 ring-green-200" 
                                : selectedDraftIds.has(draft.id) 
                                  ? "border-blue-500 ring-2 ring-blue-200" 
                                  : "border-transparent hover:border-gray-300"
                            }`}
                            onClick={() => {
                              setSelectedDraftIds(prev => {
                                const next = new Set(prev);
                                if (next.has(draft.id)) {
                                  next.delete(draft.id);
                                } else {
                                  next.add(draft.id);
                                }
                                return next;
                              });
                              setSelectedDraftId(draft.id);
                            }}
                            onDoubleClick={() => {
                              setPreviewDraft(draft);
                              setPreviewTitleMismatch(false);
                              setPreviewEditTitle(draft.title);
                              setPreviewTitleSaved(false);
                              setPreviewOverlayMode(null);
                              setPreviewTitleSize(100);
                              setPreviewTitleCutoff(null);
                              userEditedTitleRef.current = false;
                            }}
                            data-testid={`card-draft-${draft.id}`}
                          >
                            <div className="relative w-full aspect-[2/3] bg-black">
                              {coverReviewHasImage(draft) ? (
                                <CoverReviewImage
                                  draft={draft}
                                  showCleanBackgrounds={showCleanBackgrounds}
                                  className={`w-full h-full ${(coverFitOverrides.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover")) === "contain" ? "object-contain" : "object-cover"}`}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                  <Image className="w-6 h-6 text-gray-500" />
                                </div>
                              )}
                              {selectedDraftIds.has(draft.id) && (
                                <div className="absolute top-1 left-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                              {draft.overlayApproved && (
                                <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                                  <CheckCircle className="w-3 h-3" />
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCoverFitOverrides(prev => {
                                    const next = new Map(prev);
                                    const current = next.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover");
                                    next.set(draft.id, current === "cover" ? "contain" : "cover");
                                    return next;
                                  });
                                }}
                                className="absolute bottom-8 right-1 bg-black/60 backdrop-blur border border-white/10 text-white rounded w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-20"
                                title="Toggle fit mode"
                              >
                                {(coverFitOverrides.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover")) === "cover" ? (
                                  <Minimize2 className="w-3 h-3" />
                                ) : (
                                  <Maximize2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1.5">
                              <p className="text-[10px] text-white font-medium truncate">{draft.title}</p>
                              <p className="text-[9px] text-gray-400">ID: {draft.id} · {draft.genre}{draft.publishedAt ? " · Published" : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : showMissingCovers ? (
                  <div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-orange-800">
                        These {missingCoverCount} ebooks have no cover image yet. Select them, pick an AI style above, then use Generate.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {draftsForReview.map((draft) => (
                        <div
                          key={draft.id}
                          className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                            selectedDraftIds.has(draft.id) 
                              ? "border-blue-500 ring-2 ring-blue-200" 
                              : "border-orange-300 hover:border-orange-400"
                          }`}
                          onClick={() => {
                            setSelectedDraftIds(prev => {
                              const next = new Set(prev);
                              if (next.has(draft.id)) next.delete(draft.id);
                              else next.add(draft.id);
                              return next;
                            });
                            setSelectedDraftId(draft.id);
                          }}
                          data-testid={`card-missing-${draft.id}`}
                        >
                          <div className="relative w-full aspect-[2/3] bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                            <div className="text-center px-2">
                              <Image className="w-6 h-6 text-orange-400 mx-auto mb-1" />
                              <span className="text-orange-400 text-xs">No cover</span>
                            </div>
                            {selectedDraftIds.has(draft.id) && (
                              <div className="absolute top-1 left-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                                <Check className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1.5">
                            <p className="text-[10px] text-white font-medium truncate">{draft.title}</p>
                            <p className="text-[9px] text-gray-400">ID: {draft.id} · {draft.genre}{draft.publishedAt ? " · Published" : ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Grouped by Style View */
                  <div className="space-y-4">
                    {/* Render each style group */}
                    {groupedDrafts.allGroups.filter(g => g.drafts.length > 0).map(({ styleId, drafts: styleDrafts, config }) => (
                      <div key={styleId} className={`border-2 rounded-lg overflow-hidden ${
                        selectedModelStyleIds.has(styleId) 
                          ? "border-blue-500 bg-blue-50/30" 
                          : "border-gray-200 bg-gray-50/50"
                      }`}>
                        {/* Style Header Button */}
                        <div 
                          className={`flex items-center justify-between p-3 cursor-pointer transition-all ${
                            selectedModelStyleIds.has(styleId) 
                              ? "bg-gradient-to-r from-blue-100 to-blue-50" 
                              : "bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100"
                          }`}
                          onClick={() => toggleSectionExpanded(styleId)}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              className="flex items-center justify-center w-6 h-6 rounded hover:bg-black/10 transition-transform"
                              data-testid={`toggle-section-${styleId}`}
                            >
                              <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${expandedSections.has(styleId) ? "" : "-rotate-90"}`} />
                            </button>
                            <div
                              className={`w-10 h-10 bg-gradient-to-br ${config.gradient} rounded-lg flex items-center justify-center`}
                              onClick={(e) => { e.stopPropagation(); toggleStyleSelection(styleId); }}
                            >
                              <span className="text-white text-lg">{config.emoji}</span>
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${selectedModelStyleIds.has(styleId) ? 'text-blue-700' : 'text-gray-800'}`}>
                                {allStyleNames[styleId] || styleId}
                              </p>
                              <p className="text-xs text-gray-500">
                                {styleDrafts.length} covers created
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-black hover:text-black"
                              onClick={(e) => {
                                e.stopPropagation();
                                const ids = styleDrafts.map(d => d.id);
                                setSelectedDraftIds(new Set(ids));
                              }}
                              data-testid={`select-style-${styleId}`}
                            >
                              Select All
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-black hover:text-black"
                              onClick={(e) => {
                                e.stopPropagation();
                                const sectionIds = new Set(styleDrafts.map(d => d.id));
                                setSelectedDraftIds(prev => {
                                  const next = new Set(prev);
                                  sectionIds.forEach(id => next.delete(id));
                                  return next;
                                });
                              }}
                              data-testid={`unselect-style-${styleId}`}
                            >
                              Unselect All
                            </Button>
                            {selectedDraftIds.size > 0 && selectedModelStyleIds.has(styleId) && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  regenerateSelectedBackgrounds();
                                }}
                                disabled={isRegeneratingSelected}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                {isRegeneratingSelected ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                )}
                                Generate ({selectedDraftIds.size})
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Covers Grid or Empty State */}
                        {expandedSections.has(styleId) && (styleDrafts.length > 0 ? (
                          <div className="p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {styleDrafts.map((draft) => (
                      <div
                        key={draft.id}
                        className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                          selectedDraftId === draft.id
                            ? "border-green-500 ring-2 ring-green-200" 
                            : selectedDraftIds.has(draft.id) 
                              ? "border-blue-500 ring-2 ring-blue-200" 
                              : "border-transparent hover:border-gray-300"
                        }`}
                        onClick={() => {
                          setSelectedDraftIds(prev => {
                            const next = new Set(prev);
                            if (next.has(draft.id)) {
                              next.delete(draft.id);
                            } else {
                              next.add(draft.id);
                            }
                            return next;
                          });
                          setSelectedDraftId(draft.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          { if (previewAutoSaveTimer.current) clearTimeout(previewAutoSaveTimer.current); userEditedTitleRef.current = false; lastSavedDraftIdRef.current = null; setPreviewDraft(draft); setPreviewEditTitle(draft.title); setPreviewTitleMismatch(false); setPreviewTitleCutoff(null); setPreviewOverlayMode(null); setPreviewTitleSize(100); };
                        }}
                        data-testid={`card-draft-${draft.id}`}
                      >
                        <div className="relative w-full aspect-[2/3] bg-black">
                          {coverReviewHasImage(draft) ? (
                            <CoverReviewImage
                              draft={draft}
                              showCleanBackgrounds={showCleanBackgrounds}
                              className={`w-full h-full ${(coverFitOverrides.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover")) === "contain" ? "object-contain" : "object-cover"}`}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                              <span className="text-gray-500 text-xs text-center px-2">No cover yet</span>
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCoverFitOverrides(prev => {
                                const next = new Map(prev);
                                const current = next.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover");
                                next.set(draft.id, current === "cover" ? "contain" : "cover");
                                return next;
                              });
                            }}
                            className="absolute bottom-8 right-1 bg-black/60 backdrop-blur border border-white/10 text-white rounded w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-20"
                            title="Toggle fit mode"
                          >
                            {(coverFitOverrides.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover")) === "cover" ? (
                              <Minimize2 className="w-3 h-3" />
                            ) : (
                              <Maximize2 className="w-3 h-3" />
                            )}
                          </button>
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            {(draft.backgroundUrl || draft.coverUrl) && (
                              <>
                                <button
                                  className="p-1 bg-blue-600 hover:bg-blue-500 rounded text-white shadow-lg"
                                  title="Swap image"
                                  data-testid={`button-swap-cover-${draft.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSwapTargetId(draft.id);
                                    swapFileInputRef.current?.click();
                                  }}
                                >
                                  <Replace className="w-3 h-3" />
                                </button>
                                <button
                                  className="p-1 bg-orange-600 hover:bg-orange-500 rounded text-white shadow-lg"
                                  title="Remove cover only"
                                  data-testid={`button-delete-cover-${draft.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Remove cover image from "${draft.title}"? The ebook entry will remain.`)) {
                                      deleteCoverMutation.mutate(draft.id);
                                    }
                                  }}
                                >
                                  <Image className="w-3 h-3" />
                                </button>
                              </>
                            )}
                            <button
                              className="p-1 bg-red-600 hover:bg-red-500 rounded text-white shadow-lg"
                              title="Delete entire ebook"
                              data-testid={`button-delete-ebook-${draft.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete ebook "${draft.title}" entirely? This cannot be undone.`)) {
                                  deleteEbookMutation.mutate(draft.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          {analyzingIds.has(draft.id) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <div className="text-white text-xs flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Analyzing...
                              </div>
                            </div>
                          )}
                          {textPreviewIds.has(draft.id) && !analyzingIds.has(draft.id) && (() => {
                            // PRIORITY: Vault styles > Legacy AI analysis > Genre-based
                            const vaultEntry = typographyVault.get(draft.id);
                            const selectedStyleId = selectedStyleForDraft.get(draft.id);
                            const vaultStyle = vaultEntry?.styleOptions.find(s => s.id === selectedStyleId);
                            
                            // Get Visual Intelligence analysis for this cover
                            const viResult = visualIntelligence.get(draft.id);
                            const viEnhancement = viResult ? enhanceTypographyOptions(viResult, draft.title, draft.genre) : null;
                            
                            // Get Title Perfection Engine analysis (NEW)
                            const tpResult = titlePerfection.get(draft.id);
                            
                            const analysis = coverAnalysis[draft.id];
                            const genreTypo = getGenreTypography(draft.genre);
                            
                            // Priority: Vault > Title Perfection > Visual Intelligence > AI Analysis > Genre fallback
                            const titleFont = vaultStyle?.titleFont || viEnhancement?.recommendedFont || analysis?.suggestedTypography?.titleFont || genreTypo.titleFont;
                            const authorFont = vaultStyle?.authorFont || analysis?.suggestedTypography?.authorFont || genreTypo.authorFont;
                            const titleColor = vaultStyle?.titleColor || tpResult?.colors.primary || viEnhancement?.titleColor || analysis?.suggestedTypography?.titleColor || genreTypo.titleColor;
                            const titleSecondaryColor = tpResult?.colors.secondary || viEnhancement?.titleSecondaryColor || (vaultStyle as any)?.titleSecondaryColor;
                            const authorColor = vaultStyle?.authorColor || tpResult?.colors.accent || viEnhancement?.authorColor || analysis?.suggestedTypography?.authorColor || genreTypo.authorColor;
                            const position = vaultStyle?.titlePosition || viEnhancement?.titlePosition || analysis?.suggestedTypography?.titlePosition || genreTypo.position;
                            const effect = vaultStyle?.titleEffect || tpResult?.effects.primary || viEnhancement?.recommendedEffect || analysis?.suggestedTypography?.effect || genreTypo.effect;
                            
                            const skipTwoToneStyles = ["experimental-239", "test-style-f", "standalone-scenes", "artistic-painterly"];
                            const shouldSkipTwoTone = skipTwoToneStyles.includes(draft.coverStyleId || "");
                            const tpEffectClasses = tpResult?.effectClasses.filter(c => !(shouldSkipTwoTone && c === 'two-tone')).join(' ') || '';
                            
                            // Check if text already exists on the cover
                            const needsTitle = analysis?.needsTitle !== false;
                            const needsAuthor = analysis?.needsAuthor !== false;
                            
                            const getTextShadow = (eff: string) => {
                              switch (eff) {
                                case "glow": return "0 0 20px currentColor, 0 0 40px currentColor, 0 0 60px currentColor";
                                case "emboss": return "-1px -1px 0 rgba(255,255,255,0.5), 2px 2px 4px rgba(0,0,0,0.5)";
                                case "outline": return "2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000";
                                case "neon": return "0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor";
                                case "neon-glow": return "0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor";
                                case "vintage": return "3px 3px 6px rgba(0,0,0,0.6), 1px 1px 2px rgba(139,69,19,0.4)";
                                case "bold-shadow": return "4px 4px 8px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,0.7)";
                                case "elegant": return "1px 1px 2px rgba(0,0,0,0.4), 0 0 15px rgba(255,255,255,0.2)";
                                case "elegant-glow": return "0 0 15px rgba(255,255,255,0.4), 2px 2px 6px rgba(0,0,0,0.8)";
                                case "gold-emboss": return "2px 2px 4px rgba(0,0,0,0.9), 0 0 15px rgba(255,215,0,0.5), -1px -1px 0 rgba(255,215,0,0.3)";
                                case "sharp-shadow": return "4px 4px 0px rgba(0,0,0,0.95)";
                                case "cinematic": return "0 0 30px rgba(0,0,0,0.8), 2px 2px 10px rgba(0,0,0,0.9), 0 0 60px rgba(255,255,255,0.1)";
                                case "royal": return "2px 2px 8px rgba(75,0,130,0.8), 0 0 20px rgba(230,230,250,0.3)";
                                default: return "2px 2px 6px rgba(0,0,0,0.9), 0 0 12px rgba(255,255,255,0.15)";
                              }
                            };
                            // Handle all position variants including new corners
                            const getPositionClass = (pos: string) => {
                              switch(pos) {
                                case "top": return { vertical: "justify-start pt-6", horizontal: "text-center" };
                                case "top-left": return { vertical: "justify-start pt-6", horizontal: "text-left pl-3" };
                                case "top-right": return { vertical: "justify-start pt-6", horizontal: "text-right pr-3" };
                                case "center": return { vertical: "justify-center", horizontal: "text-center" };
                                case "bottom": return { vertical: "justify-end pb-6", horizontal: "text-center" };
                                case "bottom-left": return { vertical: "justify-end pb-6", horizontal: "text-left pl-3" };
                                case "bottom-right": return { vertical: "justify-end pb-6", horizontal: "text-right pr-3" };
                                default: return { vertical: "justify-start pt-6", horizontal: "text-center" };
                              }
                            };
                            const titlePos = getPositionClass(position);
                            const positionClass = titlePos.vertical;
                            
                            // If text already exists, show indicator
                            if (!needsTitle && !needsAuthor) {
                              return (
                                <div className="absolute inset-0 flex items-end justify-center p-2">
                                  <div className="bg-green-600/80 text-white text-[9px] px-2 py-1 rounded">
                                    Text already on cover
                                  </div>
                                </div>
                              );
                            }
                            
                            // Get author alignment from vault style, AI, or default to left
                            const authorAlign = vaultStyle?.authorAlignment || analysis?.suggestedTypography?.authorAlignment || "left";
                            const authorAlignClass = authorAlign === "left" ? "text-left pl-3" 
                              : authorAlign === "right" ? "text-right pr-3" 
                              : "text-center";
                            
                            // Get complexity class for styling
                            const complexityClass = viResult 
                              ? `complexity-${viResult.complexityDecision.complexityLevel}` 
                              : '';
                            const structureClass = viEnhancement?.shouldUseUnique && viResult
                              ? `structure-${viResult.titleStyle.layout.type}`
                              : 'structure-linear';
                            
                            // Get title adjustment for this draft
                            const titleAdj = getTitleAdjustment(draft.id);
                            const isEditingThisTitle = editingTitleId === draft.id;
                            
                            return (
                              <div 
                                className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none"
                                style={viResult?.cssVariables as React.CSSProperties}
                              >
                                {/* Title - positioned based on vault style or AI analysis */}
                                {needsTitle && (
                                  <div 
                                    className={`${titlePos.horizontal} pt-4 px-2 pointer-events-auto cursor-move relative`}
                                    style={{
                                      transform: `translate(${titleAdj.offsetX}%, ${titleAdj.offsetY}%)`,
                                      transition: isDraggingTitle ? 'none' : 'transform 0.15s ease-out',
                                    }}
                                    onMouseDown={(e) => handleTitleMouseDown(e, draft.id)}
                                  >
                                    <p 
                                      className={`font-bold px-1 leading-snug ${getEffectClass(effect)} ${complexityClass} ${structureClass} title-visual-enhanced ${tpEffectClasses} ${viEnhancement?.shouldUseUnique || tpResult?.styleDecision.useMultiColor ? 'title-per-word-colors title-varied-sizes' : ''} ${isEditingThisTitle ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-transparent' : ''}`}
                                      style={{ 
                                        ...getColorVariables(titleColor, titleSecondaryColor),
                                        ...(viResult?.cssVariables || {}),
                                        ...(tpResult?.cssVariables || {}),
                                        color: titleColor,
                                        fontFamily: `"${titleFont}", "Great Vibes", "Playfair Display", serif`,
                                        fontSize: `clamp(${(vaultStyle?.titleSize || 1) * titleAdj.scale * 0.9}rem, ${4 * titleAdj.scale}vw, ${(vaultStyle?.titleSize || 1) * titleAdj.scale * 1.25}rem)`,
                                        letterSpacing: titleFont.includes("Vibes") || titleFont.includes("Tangerine") || titleFont.includes("Allura") ? "0.02em" : "0.05em",
                                        fontWeight: titleFont.includes("Vibes") || titleFont.includes("Script") ? 400 : 700,
                                        textTransform: vaultStyle?.titleCase === "uppercase" ? "uppercase" : vaultStyle?.titleCase === "lowercase" ? "lowercase" : "none",
                                      } as React.CSSProperties}
                                    >
                                      {/* Render per-word spans when Title Perfection or Visual Intelligence says to use unique styling */}
                                      {(tpResult?.styleDecision.useMultiColor || viEnhancement?.shouldUseUnique) && (tpResult?.colors.perWord || viEnhancement?.perWordColors) ? (
                                        draft.title.split(' ').map((word, idx) => (
                                          <span 
                                            key={idx}
                                            className=""
                                            style={{
                                              color: tpResult?.colors.perWord?.[idx] || viEnhancement?.perWordColors?.[idx] || titleColor,
                                              fontSize: `${viEnhancement?.perWordSizes?.[idx] || 1}em`,
                                              display: 'inline-block',
                                              marginRight: '0.25em',
                                              '--word-index': idx
                                            } as React.CSSProperties}
                                          >
                                            {word}
                                          </span>
                                        ))
                                      ) : (
                                        draft.title
                                      )}
                                    </p>
                                    
                                    {/* Size controls when editing */}
                                    {isEditingThisTitle && (
                                      <div 
                                        className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gray-900/95 px-2 py-1 rounded-lg shadow-lg pointer-events-auto"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                      >
                                        <button 
                                          className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white text-sm font-bold"
                                          onClick={(e) => { e.stopPropagation(); updateTitleAdjustment(draft.id, { scale: Math.max(0.5, titleAdj.scale - 0.1) }); }}
                                        >
                                          −
                                        </button>
                                        <span className="text-white text-xs min-w-[3rem] text-center">
                                          {Math.round(titleAdj.scale * 100)}%
                                        </span>
                                        <button 
                                          className="w-6 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded text-white text-sm font-bold"
                                          onClick={(e) => { e.stopPropagation(); updateTitleAdjustment(draft.id, { scale: Math.min(2, titleAdj.scale + 0.1) }); }}
                                        >
                                          +
                                        </button>
                                        <button 
                                          className="w-6 h-6 flex items-center justify-center bg-amber-600 hover:bg-amber-500 rounded text-white text-xs"
                                          onClick={(e) => { e.stopPropagation(); updateTitleAdjustment(draft.id, { offsetX: 0, offsetY: 0, scale: 1.0 }); }}
                                          title="Reset"
                                        >
                                          ↺
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!needsTitle && <div />}
                                
                                {/* Author - bottom with elegant styling */}
                                {needsAuthor && (
                                  <div className={`${authorAlignClass} pb-3 px-2`}>
                                    <p 
                                      style={{ 
                                        color: authorColor,
                                        textShadow: getTextShadow(effect),
                                        fontFamily: `"${authorFont}", "Lora", serif`,
                                        fontSize: "clamp(0.6rem, 2.5vw, 0.75rem)",
                                        letterSpacing: "0.1em",
                                        fontWeight: 400,
                                      }}
                                    >
                                      EbookGamez
                                    </p>
                                  </div>
                                )}
                                {!needsAuthor && <div />}
                                
                                {analysis && (
                                  <div className="absolute bottom-1 left-1 bg-purple-600/80 text-white text-[8px] px-1 rounded">
                                    AI
                                  </div>
                                )}
                                {viResult && (
                                  <div 
                                    className="absolute bottom-1 right-1 bg-gradient-to-r from-cyan-600/80 to-purple-600/80 text-white text-[8px] px-1 rounded"
                                    title={`Complexity: ${(viResult.complexityDecision.finalScore * 100).toFixed(0)}% - ${viResult.complexityDecision.styleCategory}`}
                                  >
                                    VI {viResult.complexityDecision.complexityLevel[0].toUpperCase()}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          
                          {/* Style Navigator - shown when vault has styles */}
                          {typographyVault.has(draft.id) && textPreviewIds.has(draft.id) && (() => {
                            const styleInfo = getCurrentStyleInfo(draft.id);
                            if (!styleInfo) return null;
                            return (
                              <div 
                                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-4 pb-2 px-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); cycleVaultStyle(draft.id, "prev"); }}
                                    className="p-1 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                                    data-testid={`btn-style-prev-${draft.id}`}
                                  >
                                    <ChevronLeft className="w-4 h-4 text-white" />
                                  </button>
                                  <div className="flex-1 text-center">
                                    <p className="text-white text-[10px] font-medium truncate px-1">
                                      {styleInfo.name}
                                    </p>
                                    <p className="text-white/60 text-[8px]">
                                      {styleInfo.index} / {styleInfo.total}
                                    </p>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); cycleVaultStyle(draft.id, "next"); }}
                                    className="p-1 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                                    data-testid={`btn-style-next-${draft.id}`}
                                  >
                                    <ChevronRight className="w-4 h-4 text-white" />
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                          {/* Title name tag at bottom */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] p-1 text-center truncate">
                            {draft.title}
                          </div>
                        </div>
                        {selectedDraftIds.has(draft.id) && (
                          <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        {selectedDraftId === draft.id && (
                          <div className="absolute top-2 left-2 bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded">
                            Editing
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                          <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">
                            Click to edit
                          </span>
                        </div>
                      </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 text-center text-gray-400 text-xs">
                            No covers created with this style yet. Select covers and click Generate.
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Ungrouped covers (no style assigned yet) */}
                    {groupedDrafts.ungrouped.length > 0 && (() => {
                      const titlePlacers = groupedDrafts.ungrouped
                        .filter(isTitlePlacerDraft)
                        .sort((a, b) => a.id - b.id);
                      const pendingOverlay = groupedDrafts.ungrouped.filter(d => coverReviewHasImage(d) && !d.overlayApproved);
                      const approvedOverlay = groupedDrafts.ungrouped.filter(d => coverReviewHasImage(d) && d.overlayApproved);
                      const selectedPendingIds = pendingOverlay.filter(d => selectedDraftIds.has(d.id)).map(d => d.id);
                      const selectedApprovedIds = approvedOverlay.filter(d => selectedDraftIds.has(d.id)).map(d => d.id);
                      return (
                        <>
                    {pendingOverlay.length > 0 && (
                      <div className="border border-dashed border-amber-400 rounded-lg overflow-hidden bg-amber-50">
                        <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => toggleSectionExpanded("__pending__")}>
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`w-5 h-5 text-amber-600 transition-transform duration-200 ${expandedSections.has("__pending__") ? "" : "-rotate-90"}`} />
                            <span className="text-sm font-medium text-amber-800">
                              Pending AI Title Overlay
                            </span>
                            <span className="text-sm text-amber-700">
                              ({pendingOverlay.length} covers)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedPendingIds.length > 0 && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-500 text-white"
                                onClick={async () => {
                                  try {
                                    const res = await apiRequest("POST", "/api/content-studio/approve-overlay", { draftIds: selectedPendingIds });
                                    const data = await res.json();
                                    toast({ title: "Overlay Approved", description: data.message });
                                    queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
                                    setSelectedDraftIds(prev => {
                                      const next = new Set(prev);
                                      selectedPendingIds.forEach(id => next.delete(id));
                                      return next;
                                    });
                                  } catch {
                                    toast({ title: "Error", description: "Failed to approve overlays.", variant: "destructive" });
                                  }
                                }}
                                data-testid="approve-overlay-btn"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Approve Overlay ({selectedPendingIds.length})
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-800 hover:text-amber-900"
                              onClick={() => {
                                const ids = pendingOverlay.map(d => d.id);
                                setSelectedDraftIds(prev => {
                                  const next = new Set(prev);
                                  ids.forEach(id => next.add(id));
                                  return next;
                                });
                              }}
                              data-testid="select-pending-overlay"
                            >
                              Select All
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-800 hover:text-amber-900"
                              onClick={() => {
                                const sectionIds = new Set(pendingOverlay.map(d => d.id));
                                setSelectedDraftIds(prev => {
                                  const next = new Set(prev);
                                  sectionIds.forEach(id => next.delete(id));
                                  return next;
                                });
                              }}
                              data-testid="unselect-pending-overlay"
                            >
                              Unselect All
                            </Button>
                          </div>
                        </div>
                        {expandedSections.has("__pending__") && (<>
                        <p className="text-xs text-amber-700 mb-3 px-3">
                          These covers need AI title overlay. Double-click to edit, then check off and approve when finished.
                        </p>
                        <div className="px-3 pb-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {pendingOverlay.map((draft) => (
                            <div
                              key={draft.id}
                              className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                selectedDraftId === draft.id
                                  ? "border-green-500 ring-2 ring-green-200" 
                                  : selectedDraftIds.has(draft.id) 
                                    ? "border-blue-500 ring-2 ring-blue-200" 
                                    : "border-transparent hover:border-gray-300"
                              }`}
                              onClick={() => {
                                setSelectedDraftIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(draft.id)) {
                                    next.delete(draft.id);
                                  } else {
                                    next.add(draft.id);
                                  }
                                  return next;
                                });
                                setSelectedDraftId(draft.id);
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                { if (previewAutoSaveTimer.current) clearTimeout(previewAutoSaveTimer.current); userEditedTitleRef.current = false; lastSavedDraftIdRef.current = null; setPreviewDraft(draft); setPreviewEditTitle(draft.title); setPreviewTitleMismatch(false); setPreviewTitleCutoff(null); setPreviewOverlayMode(null); setPreviewTitleSize(100); };
                              }}
                              data-testid={`card-draft-${draft.id}`}
                            >
                              <div className="relative w-full aspect-[2/3] bg-black">
                                {coverReviewHasImage(draft) ? (
                                  <CoverReviewImage
                                    draft={draft}
                                    showCleanBackgrounds={showCleanBackgrounds}
                                    className={`w-full h-full ${(coverFitOverrides.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover")) === "contain" ? "object-contain" : "object-cover"}`}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                    <span className="text-gray-500 text-xs text-center px-2">No cover yet</span>
                                  </div>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCoverFitOverrides(prev => {
                                      const next = new Map(prev);
                                      const current = next.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover");
                                      next.set(draft.id, current === "cover" ? "contain" : "cover");
                                      return next;
                                    });
                                  }}
                                  className="absolute bottom-8 right-1 bg-black/60 backdrop-blur border border-white/10 text-white rounded w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-10"
                                  title="Toggle fit mode"
                                >
                                  {(coverFitOverrides.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover")) === "cover" ? (
                                    <Minimize2 className="w-3 h-3" />
                                  ) : (
                                    <Maximize2 className="w-3 h-3" />
                                  )}
                                </button>
                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  {(draft.backgroundUrl || draft.coverUrl) && (
                                    <>
                                      <button
                                        className="p-1 bg-green-600 hover:bg-green-500 rounded text-white shadow-lg"
                                        title="Move cover to another ebook"
                                        data-testid={`button-reassign-cover-${draft.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReassignSourceId(draft.id);
                                          setReassignSearch("");
                                        }}
                                      >
                                        <ArrowRight className="w-3 h-3" />
                                      </button>
                                      <button
                                        className="p-1 bg-blue-600 hover:bg-blue-500 rounded text-white shadow-lg"
                                        title="Swap image"
                                        data-testid={`button-swap-cover-ungrouped-${draft.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSwapTargetId(draft.id);
                                          swapFileInputRef.current?.click();
                                        }}
                                      >
                                        <Replace className="w-3 h-3" />
                                      </button>
                                      <button
                                        className="p-1 bg-orange-600 hover:bg-orange-500 rounded text-white shadow-lg"
                                        title="Remove cover only"
                                        data-testid={`button-delete-cover-ungrouped-${draft.id}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm(`Remove cover image from "${draft.title}"? The ebook entry will remain.`)) {
                                            deleteCoverMutation.mutate(draft.id);
                                          }
                                        }}
                                      >
                                        <Image className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                  <button
                                    className="p-1 bg-red-600 hover:bg-red-500 rounded text-white shadow-lg"
                                    title="Delete entire ebook"
                                    data-testid={`button-delete-ebook-ungrouped-${draft.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Delete ebook "${draft.title}" entirely? This cannot be undone.`)) {
                                        deleteEbookMutation.mutate(draft.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                {analyzingIds.has(draft.id) && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <div className="text-white text-xs flex items-center gap-2">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Analyzing...
                                    </div>
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] p-1 text-center truncate">
                                  {draft.title}
                                </div>
                              </div>
                              {selectedDraftIds.has(draft.id) && (
                                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                                <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">
                                  Double-click to edit title
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        </>)}
                      </div>
                    )}

                    {approvedOverlay.length > 0 && (
                      <div className="border border-dashed border-green-400 rounded-lg overflow-hidden bg-green-50">
                        <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => toggleSectionExpanded("__approved__")}>
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`w-5 h-5 text-green-600 transition-transform duration-200 ${expandedSections.has("__approved__") ? "" : "-rotate-90"}`} />
                            <Check className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                              Overlay Approved
                            </span>
                            <span className="text-sm text-green-700">
                              ({approvedOverlay.length} covers)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedApprovedIds.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-400 text-amber-700 hover:bg-amber-50"
                                onClick={async () => {
                                  try {
                                    const res = await apiRequest("POST", "/api/content-studio/unapprove-overlay", { draftIds: selectedApprovedIds });
                                    const data = await res.json();
                                    toast({ title: "Moved Back", description: data.message });
                                    queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
                                    setSelectedDraftIds(prev => {
                                      const next = new Set(prev);
                                      selectedApprovedIds.forEach(id => next.delete(id));
                                      return next;
                                    });
                                  } catch {
                                    toast({ title: "Error", description: "Failed to unapprove overlays.", variant: "destructive" });
                                  }
                                }}
                                data-testid="unapprove-overlay-btn"
                              >
                                Move Back to Pending ({selectedApprovedIds.length})
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-800 hover:text-green-900"
                              onClick={() => {
                                const ids = approvedOverlay.map(d => d.id);
                                setSelectedDraftIds(prev => {
                                  const next = new Set(prev);
                                  ids.forEach(id => next.add(id));
                                  return next;
                                });
                              }}
                              data-testid="select-approved-overlay"
                            >
                              Select All
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-800 hover:text-green-900"
                              onClick={() => {
                                const sectionIds = new Set(approvedOverlay.map(d => d.id));
                                setSelectedDraftIds(prev => {
                                  const next = new Set(prev);
                                  sectionIds.forEach(id => next.delete(id));
                                  return next;
                                });
                              }}
                              data-testid="unselect-approved-overlay"
                            >
                              Unselect All
                            </Button>
                          </div>
                        </div>
                        {expandedSections.has("__approved__") && (
                        <div className="px-3 pb-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {approvedOverlay.map((draft) => (
                            <div
                              key={draft.id}
                              className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                selectedDraftIds.has(draft.id) 
                                    ? "border-blue-500 ring-2 ring-blue-200" 
                                    : "border-green-300 hover:border-green-400"
                              }`}
                              onClick={() => {
                                setSelectedDraftIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(draft.id)) {
                                    next.delete(draft.id);
                                  } else {
                                    next.add(draft.id);
                                  }
                                  return next;
                                });
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                { if (previewAutoSaveTimer.current) clearTimeout(previewAutoSaveTimer.current); userEditedTitleRef.current = false; lastSavedDraftIdRef.current = null; setPreviewDraft(draft); setPreviewEditTitle(draft.title); setPreviewTitleMismatch(false); setPreviewTitleCutoff(null); setPreviewOverlayMode(null); setPreviewTitleSize(100); };
                              }}
                              data-testid={`card-approved-${draft.id}`}
                            >
                              <div className="relative w-full aspect-[2/3] bg-black">
                                {coverReviewHasImage(draft) ? (
                                  <CoverReviewImage
                                    draft={draft}
                                    showCleanBackgrounds={showCleanBackgrounds}
                                    className={`w-full h-full ${(coverFitOverrides.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover")) === "contain" ? "object-contain" : "object-cover"}`}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                    <span className="text-gray-500 text-xs text-center px-2">No cover</span>
                                  </div>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCoverFitOverrides(prev => {
                                      const next = new Map(prev);
                                      const current = next.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover");
                                      next.set(draft.id, current === "cover" ? "contain" : "cover");
                                      return next;
                                    });
                                  }}
                                  className="absolute bottom-8 right-1 bg-black/60 backdrop-blur border border-white/10 text-white rounded w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-20"
                                  title="Toggle fit mode"
                                >
                                  {(coverFitOverrides.get(draft.id) || ((draft.coverUrl || "").includes("ai-overlay") ? "contain" : "cover")) === "cover" ? (
                                    <Minimize2 className="w-3 h-3" />
                                  ) : (
                                    <Maximize2 className="w-3 h-3" />
                                  )}
                                </button>
                                <div className="absolute top-1 left-1">
                                  <div className="bg-green-500 rounded-full p-0.5">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] p-1 text-center truncate">
                                  {draft.title}
                                </div>
                              </div>
                              {selectedDraftIds.has(draft.id) && (
                                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        )}
                      </div>
                    )}

                    {titlePlacers.length > 0 && (
                      <div id="section-title-placers" className="border-2 border-dashed border-violet-400 rounded-lg overflow-hidden bg-violet-50/80">
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer"
                          onClick={() => toggleSectionExpanded("__placers__")}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`w-5 h-5 text-violet-600 transition-transform duration-200 ${expandedSections.has("__placers__") ? "" : "-rotate-90"}`} />
                            <Lightbulb className="w-4 h-4 text-violet-600" />
                            <span className="text-sm font-medium text-violet-900">
                              Awaiting AI Style &amp; Cover
                            </span>
                            <span className="text-sm text-violet-700">({titlePlacers.length} title placers)</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-violet-800 hover:text-violet-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              const ids = titlePlacers.map(d => d.id);
                              setSelectedDraftIds(prev => {
                                const next = new Set(prev);
                                ids.forEach(id => next.add(id));
                                return next;
                              });
                            }}
                            data-testid="select-title-placers"
                          >
                            Select All
                          </Button>
                        </div>
                        {expandedSections.has("__placers__") && (
                          <>
                            <p className="text-xs text-violet-800 mb-3 px-3">
                              New research ideas land here first. Pick an AI style in the sections above, select placers, then Generate backgrounds.
                            </p>
                            <div className="px-3 pb-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                              {titlePlacers.map((draft) => (
                                <div
                                  key={draft.id}
                                  className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                                    selectedDraftIds.has(draft.id)
                                      ? "border-blue-500 ring-2 ring-blue-200"
                                      : "border-violet-300 hover:border-violet-500"
                                  }`}
                                  onClick={() => {
                                    setSelectedDraftIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(draft.id)) next.delete(draft.id);
                                      else next.add(draft.id);
                                      return next;
                                    });
                                    setSelectedDraftId(draft.id);
                                  }}
                                  data-testid={`card-placer-${draft.id}`}
                                >
                                  <div className="relative w-full aspect-[2/3] bg-gradient-to-br from-violet-900/40 to-gray-900 flex flex-col items-center justify-center gap-2 px-2">
                                    <Lightbulb className="w-7 h-7 text-violet-300" />
                                    <span className="text-violet-200 text-[10px] text-center font-medium">Title placer</span>
                                    <span className="text-violet-400/80 text-[9px] text-center">No style yet</span>
                                  </div>
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1.5">
                                    <p className="text-[10px] text-white font-medium truncate">{draft.title}</p>
                                    <p className="text-[9px] text-gray-400">ID: {draft.id} · {draft.genre}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      <Dialog open={reassignSourceId !== null} onOpenChange={(open) => {
        if (!open) { setReassignSourceId(null); setReassignSearch(""); }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Move Cover to Another Ebook</DialogTitle>
            <DialogDescription>
              {(() => {
                const source = drafts.find(d => d.id === reassignSourceId);
                return source ? `Move the cover from "${source.title}" to a coverless ebook. The source ebook will be deleted.` : "";
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <input
              type="text"
              placeholder="Search by title or genre..."
              value={reassignSearch}
              onChange={(e) => setReassignSearch(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
              data-testid="input-reassign-search"
            />
            <div className="overflow-y-auto flex-1 max-h-[50vh] border rounded-md">
              {(() => {
                const coverlessEbooks = drafts.filter(d =>
                  !d.coverUrl && !d.backgroundUrl && d.id !== reassignSourceId
                );
                const filtered = coverlessEbooks.filter(d => {
                  if (!reassignSearch) return true;
                  const q = reassignSearch.toLowerCase();
                  return d.title?.toLowerCase().includes(q) || d.genre?.toLowerCase().includes(q);
                });
                if (filtered.length === 0) {
                  return (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      {coverlessEbooks.length === 0 ? "No coverless ebooks available" : "No matches found"}
                    </div>
                  );
                }
                return filtered.map(target => (
                  <button
                    key={target.id}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 flex items-center justify-between gap-2"
                    data-testid={`button-reassign-to-${target.id}`}
                    disabled={reassignCoverMutation.isPending}
                    onClick={() => {
                      if (reassignSourceId) {
                        reassignCoverMutation.mutate({ fromId: reassignSourceId, toId: target.id });
                      }
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{target.title}</div>
                      <div className="text-xs text-gray-500">{target.genre} · #{target.id}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                ));
              })()}
            </div>
          </div>
          {reassignCoverMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Moving cover...
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDuplicatesPopup} onOpenChange={(open) => {
        setShowDuplicatesPopup(open);
        if (!open) { setAiMatches(new Map()); setAiMatchingId(null); setAiTitleSuggestions(new Map()); setAiTitleSuggestingId(null); }
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl text-purple-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Duplicate Covers — Choose Which to Retitle
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {duplicateTitles.size} title{duplicateTitles.size !== 1 ? "s" : ""} with duplicate entries. Click the cover you want to give a new title. The other cover keeps the original title.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {Array.from(duplicateTitles.entries()).map(([normalizedTitle, ids]) => {
              const groupDrafts = ids.map(id => drafts.find(d => d.id === id)).filter(Boolean) as DraftEbook[];
              if (groupDrafts.length === 0) return null;
              const chosen = chosenDuplicates.get(normalizedTitle);
              const matchesPublished = publishedBooks.some(b => (b.title || "").trim().toLowerCase() === normalizedTitle);
              return (
                <div key={normalizedTitle} className={`border-2 rounded-lg p-4 ${matchesPublished && groupDrafts.length === 1 ? "border-orange-300 bg-orange-50/20" : "border-purple-200 bg-purple-50/20"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-purple-900">
                      "{groupDrafts[0].title}" — {matchesPublished && groupDrafts.length === 1 ? "already published — rename to publish new version" : `${groupDrafts.length} versions`}
                    </h3>
                    {chosen && (
                      <span className="text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Retitling ID {chosen}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {groupDrafts.map((draft) => {
                      const isChosen = chosen === draft.id;
                      const isRejected = chosen !== undefined && chosen !== draft.id;
                      const aiMatch = aiMatches.get(draft.id);
                      const isAiMatching = aiMatchingId === draft.id;
                      return (
                        <div key={draft.id} className="space-y-1">
                          <div
                            className={`relative cursor-pointer rounded-lg overflow-hidden border-3 transition-all group ${
                              isChosen
                                ? "border-blue-500 ring-2 ring-blue-300 shadow-lg scale-[1.02]"
                                : isRejected
                                  ? "border-green-400 hover:border-green-500 hover:shadow-md"
                                  : "border-gray-300 hover:border-purple-400 hover:shadow-md"
                            }`}
                            onClick={() => {
                              setChosenDuplicates(prev => {
                                const next = new Map(prev);
                                if (isChosen) {
                                  next.delete(normalizedTitle);
                                } else {
                                  next.set(normalizedTitle, draft.id);
                                }
                                return next;
                              });
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              { if (previewAutoSaveTimer.current) clearTimeout(previewAutoSaveTimer.current); userEditedTitleRef.current = false; lastSavedDraftIdRef.current = null; setPreviewDraft(draft); setPreviewEditTitle(draft.title); setPreviewTitleMismatch(false); setPreviewTitleCutoff(null); setPreviewOverlayMode(null); setPreviewTitleSize(100); };
                            }}
                            data-testid={`popup-duplicate-${draft.id}`}
                          >
                            <div className="relative w-full aspect-[2/3]">
                              {coverReviewHasImage(draft) ? (
                                <CoverReviewImage
                                  draft={draft}
                                  showCleanBackgrounds={showCleanBackgrounds}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                  <span className="text-gray-500 text-xs text-center px-2">No cover</span>
                                </div>
                              )}
                              {isChosen && (
                                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg">
                                  <Sparkles className="w-4 h-4" />
                                </div>
                              )}
                              {isRejected && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg" title="Click to retitle this one instead">
                                  <Check className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="p-2 bg-white">
                              <p className="text-xs font-medium truncate">{draft.title}</p>
                              <p className="text-[10px] text-gray-500">ID: {draft.id} · {draft.genre}</p>
                              <p className="text-[10px] text-purple-600">{draft.coverStyleId || "no style"}</p>
                              {isChosen && (
                                <p className="text-[10px] text-blue-600 mt-0.5 font-medium">Will be retitled &amp; sent to Pending AI Title Overlay</p>
                              )}
                              {isRejected && (
                                <p className="text-[10px] text-green-600 mt-0.5 font-medium">Keeps original title</p>
                              )}
                            </div>
                          </div>

                          {isChosen && (
                            <div className="flex gap-1 flex-wrap">
                              <button
                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors disabled:opacity-50"
                                disabled={aiTitleSuggestingId === draft.id}
                                onClick={async () => {
                                  setAiTitleSuggestingId(draft.id);
                                  try {
                                    const res = await apiRequest("POST", "/api/content-studio/ai-suggest-title", {
                                      draftId: draft.id,
                                    });
                                    const data = await res.json();
                                    if (data.suggestions?.length > 0) {
                                      setAiTitleSuggestions(prev => {
                                        const next = new Map(prev);
                                        next.set(draft.id, data.suggestions);
                                        return next;
                                      });
                                    } else {
                                      toast({ title: "No suggestions", description: "AI could not suggest titles for this cover." });
                                    }
                                  } catch {
                                    toast({ title: "AI Title failed", description: "Could not generate title suggestions.", variant: "destructive" });
                                  } finally {
                                    setAiTitleSuggestingId(null);
                                  }
                                }}
                                data-testid={`button-ai-title-${draft.id}`}
                              >
                                {aiTitleSuggestingId === draft.id ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" /> Thinking...</>
                                ) : (
                                  <><Sparkles className="w-3 h-3" /> AI Title</>
                                )}
                              </button>
                              <button
                                className="flex items-center justify-center gap-1 px-2 py-1 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                                onClick={async () => {
                                  if (confirm(`Delete "${draft.title}" (ID ${draft.id})? This cannot be undone.`)) {
                                    try {
                                      await apiRequest("DELETE", `/api/content-studio/drafts/${draft.id}`);
                                      toast({ title: "Deleted", description: `"${draft.title}" removed.` });
                                      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
                                    } catch {
                                      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
                                    }
                                  }
                                }}
                                data-testid={`button-delete-duplicate-${draft.id}`}
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                          )}

                          {aiMatch && isRejected && (
                            <div className="bg-green-50 border border-green-200 rounded p-2 text-[10px]">
                              <div className="flex items-center gap-1 text-green-800 font-medium mb-1">
                                <Wand2 className="w-3 h-3" /> AI Suggestion
                                <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                  aiMatch.confidence === "high" ? "bg-green-200 text-green-800" :
                                  aiMatch.confidence === "medium" ? "bg-yellow-200 text-yellow-800" :
                                  "bg-red-200 text-red-800"
                                }`}>{aiMatch.confidence}</span>
                              </div>
                              <p className="text-gray-700 mb-1">
                                <ArrowRight className="w-3 h-3 inline mr-0.5" />
                                <strong>"{aiMatch.title}"</strong> ({aiMatch.genre})
                              </p>
                              <p className="text-gray-500 italic mb-2">{aiMatch.reason}</p>
                              <div className="flex gap-1">
                                <button
                                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-medium transition-colors"
                                  onClick={async () => {
                                    try {
                                      const res = await apiRequest("POST", "/api/content-studio/reassign-cover", {
                                        fromId: draft.id,
                                        toId: aiMatch.id,
                                      });
                                      const data = await res.json();
                                      toast({
                                        title: "Cover reassigned",
                                        description: `Cover moved to "${aiMatch.title}"`,
                                      });
                                      setAiMatches(prev => {
                                        const next = new Map(prev);
                                        next.delete(draft.id);
                                        return next;
                                      });
                                      queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
                                    } catch {
                                      toast({ title: "Error", description: "Failed to reassign cover.", variant: "destructive" });
                                    }
                                  }}
                                  data-testid={`button-accept-ai-match-${draft.id}`}
                                >
                                  <Check className="w-3 h-3" /> Reassign
                                </button>
                                <button
                                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px] transition-colors"
                                  onClick={() => {
                                    setAiMatches(prev => {
                                      const next = new Map(prev);
                                      next.delete(draft.id);
                                      return next;
                                    });
                                  }}
                                  data-testid={`button-dismiss-ai-match-${draft.id}`}
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          )}

                          {aiTitleSuggestions.get(draft.id) && isChosen && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-2 text-[10px]">
                              <div className="flex items-center gap-1 text-blue-800 font-medium mb-2">
                                <Sparkles className="w-3 h-3" /> AI Title Suggestions
                                <button
                                  className="ml-auto text-gray-400 hover:text-gray-600 text-[9px]"
                                  onClick={() => {
                                    setAiTitleSuggestions(prev => {
                                      const next = new Map(prev);
                                      next.delete(draft.id);
                                      return next;
                                    });
                                  }}
                                  data-testid={`button-dismiss-ai-title-${draft.id}`}
                                >
                                  Dismiss
                                </button>
                              </div>
                              {aiTitleSuggestions.get(draft.id)!.map((suggestion, idx) => (
                                <div key={idx} className="mb-2 last:mb-0 bg-white/60 rounded p-1.5">
                                  <p className="text-gray-800 font-medium">"{suggestion.title}"</p>
                                  <p className="text-gray-500 text-[9px]">{suggestion.genre} — {suggestion.reason}</p>
                                  <button
                                    className="mt-1 w-full flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-medium transition-colors disabled:opacity-50"
                                    disabled={applyingTitleId === draft.id}
                                    onClick={async () => {
                                      setApplyingTitleId(draft.id);
                                      try {
                                        await apiRequest("PATCH", `/api/content-studio/drafts/${draft.id}`, {
                                          title: suggestion.title,
                                          genre: suggestion.genre,
                                        });
                                        toast({
                                          title: "Title updated",
                                          description: `Renamed to "${suggestion.title}"`,
                                        });
                                        setAiTitleSuggestions(prev => {
                                          const next = new Map(prev);
                                          next.delete(draft.id);
                                          return next;
                                        });
                                        queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
                                      } catch {
                                        toast({ title: "Error", description: "Failed to update title.", variant: "destructive" });
                                      } finally {
                                        setApplyingTitleId(null);
                                      }
                                    }}
                                    data-testid={`button-apply-ai-title-${draft.id}-${idx}`}
                                  >
                                    {applyingTitleId === draft.id ? (
                                      <><Loader2 className="w-3 h-3 animate-spin" /> Applying...</>
                                    ) : (
                                      <><Check className="w-3 h-3" /> Use This Title</>
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              {chosenDuplicates.size} of {duplicateTitles.size} titles selected for retitling
              {chosenDuplicates.size > 0 && chosenDuplicates.size < duplicateTitles.size && (
                <span className="text-orange-600 ml-1">
                  — unselected groups stay unchanged
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowDuplicatesPopup(false); setAiMatches(new Map()); setAiMatchingId(null); setAiTitleSuggestions(new Map()); setAiTitleSuggestingId(null); }}
                data-testid="button-cancel-duplicates"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={chosenDuplicates.size === 0 || deletingDuplicates}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={async () => {
                  const retitleIds: number[] = [];
                  duplicateTitles.forEach((ids, title) => {
                    const chosen = chosenDuplicates.get(title);
                    if (chosen) retitleIds.push(chosen);
                  });
                  if (retitleIds.length === 0) {
                    toast({ title: "Nothing to process", description: "Select a cover to retitle for at least one title." });
                    return;
                  }
                  setDeletingDuplicates(true);
                  try {
                    for (const id of retitleIds) {
                      await apiRequest("PATCH", `/api/content-studio/drafts/${id}`, {
                        overlayApproved: false,
                        coverUrl: null,
                      });
                    }
                    toast({
                      title: "Sent to Pending AI Title Overlay",
                      description: `${retitleIds.length} cover${retitleIds.length !== 1 ? "s" : ""} sent for retitling.`,
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
                    setShowDuplicatesPopup(false);
                    setChosenDuplicates(new Map());
                    setAiMatches(new Map());
                  } catch (error) {
                    toast({ title: "Error", description: "Failed to process. Please try again.", variant: "destructive" });
                  } finally {
                    setDeletingDuplicates(false);
                  }
                }}
                data-testid="button-confirm-resolve-duplicates"
              >
                {deletingDuplicates ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Processing...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-1" /> Send {chosenDuplicates.size} to Pending AI Title Overlay</>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewDraft} onOpenChange={(open) => { if (!open) { if (previewAutoSaveTimer.current) clearTimeout(previewAutoSaveTimer.current); userEditedTitleRef.current = false; lastSavedDraftIdRef.current = null; setPreviewDraft(null); setPreviewTitleMismatch(false); setPreviewSavingTitle(false); setPreviewGeneratingOverlay(false); setPreviewTitleCutoff(null); setPreviewOverlayMode(null); setPreviewTitleSize(100); setPreviewGeneratedTitles([]); } }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-gray-950 border-gray-700 max-h-[95vh] overflow-y-auto" data-testid="dialog-cover-preview">
          <div className="flex flex-col items-center">
            {previewDraft && coverReviewHasImage(previewDraft) && (
              <CoverReviewImage
                draft={previewDraft}
                showCleanBackgrounds={showCleanBackgrounds}
                className="w-full max-h-[50vh] object-contain"
                data-testid="img-cover-preview"
              />
            )}
            <div className="w-full p-4 space-y-3 border-t border-gray-800">
              <div className="bg-gray-900 rounded p-3 border border-gray-700">
                <div className="flex flex-wrap gap-2 text-xs text-gray-300 mb-2">
                  <span data-testid="text-preview-genre">{previewDraft?.genre}</span>
                  <span className="text-gray-600">|</span>
                  <span>ID: {previewDraft?.id}</span>
                  <span className="text-gray-600">|</span>
                  <span className="text-blue-300">{previewDraft?.coverStyleId ? (allStyleNames[previewDraft.coverStyleId] || previewDraft.coverStyleId) : "No style"}</span>
                  {previewDraft?.backgroundUrl && (
                    <>
                      <span className="text-gray-600">|</span>
                      <span className="text-green-400">Has clean background</span>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-gray-900 rounded p-3 border border-gray-700">
                <p className="text-[10px] uppercase tracking-wider text-purple-400 font-bold mb-2">Ebook Title</p>
                <p className="text-sm text-white mb-2" data-testid="text-db-title">{previewDraft?.title}</p>
                {previewDraft?.title && previewDraft.title.length > 40 && (
                  <p className="text-yellow-400 text-[10px] font-medium">({previewDraft.title.length} characters)</p>
                )}
              </div>

              <button
                disabled={previewRegeneratingTitle}
                onClick={async () => {
                  if (!previewDraft) return;
                  setPreviewRegeneratingTitle(true);
                  try {
                    const res = await fetch(`/api/content-studio/regenerate-title/${previewDraft.id}`, { method: "POST" });
                    if (!res.ok) throw new Error("Failed");
                    const data = await res.json();
                    setPreviewGeneratedTitles(prev => [...prev, data.title]);
                    setPreviewDraft({ ...previewDraft, title: data.title });
                    setPreviewEditTitle(data.title);
                    queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
                  } catch {
                    alert("Failed to regenerate title");
                  } finally {
                    setPreviewRegeneratingTitle(false);
                  }
                }}
                className="w-full py-3 px-4 rounded border border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="button-regenerate-title-preview"
              >
                {previewRegeneratingTitle ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating New Title...</> : <><RefreshCw className="h-4 w-4" /> Generate New Title from Description</>}
              </button>

              {previewGeneratedTitles.length > 0 && (
                <div className="bg-gray-900 rounded p-3 border border-amber-700 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Generated Titles (click to apply)</p>
                  {previewGeneratedTitles.map((t, i) => (
                    <button
                      key={i}
                      onClick={async () => {
                        if (!previewDraft) return;
                        await fetch(`/api/content-studio/drafts/${previewDraft.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: t }),
                        });
                        setPreviewDraft({ ...previewDraft, title: t });
                        setPreviewEditTitle(t);
                        queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts"] });
                      }}
                      className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                        previewDraft?.title === t
                          ? "border-green-500 bg-green-500/20 text-green-300"
                          : "border-gray-600 bg-gray-800 text-white hover:border-amber-500 hover:bg-amber-500/10"
                      }`}
                      data-testid={`button-pick-title-${i}`}
                    >
                      {previewDraft?.title === t && <Check className="w-3 h-3 inline mr-2 text-green-400" />}
                      {t}
                    </button>
                  ))}
                  <p className="text-[10px] text-gray-500">The last generated title is automatically saved. Click any previous title to switch back to it.</p>
                </div>
              )}

              <div
                className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${previewTitleMismatch ? "bg-red-900/30 border-red-700" : "bg-gray-900 border-gray-700 hover:border-gray-500"}`}
                onClick={() => setPreviewTitleMismatch(!previewTitleMismatch)}
                data-testid="checkbox-title-mismatch"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${previewTitleMismatch ? "bg-red-600 border-red-600" : "border-gray-500"}`}>
                  {previewTitleMismatch && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className={`text-sm font-medium ${previewTitleMismatch ? "text-red-300" : "text-gray-300"}`}>
                  Cover title and ebook title do not match
                </span>
              </div>

              {previewTitleMismatch && (
                <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="bg-gray-900 rounded p-3 border border-amber-700">
                    <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-2">Edit Ebook Title</p>
                    <p className="text-[10px] text-gray-400 mb-2">Edit the title below to what it should be. This will become the new ebook title.</p>
                    <textarea
                      className="w-full bg-gray-800 text-white text-sm rounded p-3 border border-gray-600 focus:border-amber-500 focus:outline-none resize-none min-h-[80px]"
                      value={previewEditTitle}
                      onChange={(e) => { userEditedTitleRef.current = true; setPreviewEditTitle(e.target.value); setPreviewTitleMismatch(true); }}
                      data-testid="input-edit-title"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-500">{previewEditTitle.length} characters</span>
                      <span className="text-[10px] font-medium">
                        {previewSavingTitle ? (
                          <span className="text-amber-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>
                        ) : previewTitleSaved ? (
                          <span className="text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>
                        ) : previewEditTitle !== previewDraft?.title ? (
                          <span className="text-amber-400">Editing...</span>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded p-3 border border-gray-700">
                    <p className="text-[10px] uppercase tracking-wider text-purple-400 font-bold mb-2">Set Main Title Boundary</p>
                    <p className="text-[10px] text-gray-400 mb-3">Click the last word you want on the cover. Blue words = will appear on cover. Gray words = will be excluded or shown smaller.</p>
                    {(() => {
                      const currentTitle = previewEditTitle || previewDraft?.title || "";
                      const words = currentTitle.split(/\s+/).filter(w => w.length > 0);
                      const splitAt = previewTitleCutoff !== null ? previewTitleCutoff : words.length;
                      const mainPart = words.slice(0, splitAt).join(" ");
                      const subPart = words.slice(splitAt).join(" ");
                      return (
                        <>
                          <div className="flex flex-wrap gap-1 mb-3" data-testid="word-selector-container">
                            {words.map((word, i) => {
                              const isMain = i < splitAt;
                              return (
                                <span
                                  key={i}
                                  onClick={() => setPreviewTitleCutoff(i + 1)}
                                  className={`px-2 py-1 rounded cursor-pointer text-xs font-medium transition-all select-none border ${
                                    isMain
                                      ? "bg-blue-600/50 border-blue-500 text-blue-100 hover:bg-blue-500/60"
                                      : "bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
                                  } ${i + 1 === splitAt ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900" : ""}`}
                                  data-testid={`word-select-${i}`}
                                  title={`Click to set main title ending at "${word}"`}
                                >
                                  {word}
                                </span>
                              );
                            })}
                          </div>

                          {splitAt < words.length && (
                            <div className="space-y-1 mb-3 bg-gray-800/50 rounded p-2 border border-gray-700">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] uppercase tracking-wider text-blue-400 font-bold w-16">Main:</span>
                                <span className="text-xs text-blue-200 font-medium">{mainPart}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] uppercase tracking-wider text-purple-400 font-bold w-16">Subtitle:</span>
                                <span className="text-[10px] text-purple-300 italic">{subPart}</span>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <div
                              className={`p-3 rounded border cursor-pointer transition-colors ${previewOverlayMode === "main-only" ? "bg-blue-900/40 border-blue-500" : "border-gray-600 hover:border-gray-400"}`}
                              onClick={() => setPreviewOverlayMode(previewOverlayMode === "main-only" ? null : "main-only")}
                              data-testid="option-main-title-only"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${previewOverlayMode === "main-only" ? "border-blue-400" : "border-gray-500"}`}>
                                  {previewOverlayMode === "main-only" && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                                </div>
                                <span className="text-sm font-medium text-white">Main Title Only</span>
                                <span className="text-[10px] text-gray-500 ml-auto">{splitAt < words.length ? `"${mainPart}"` : "full title on cover"}</span>
                              </div>
                            </div>

                            <div
                              className={`p-3 rounded border cursor-pointer transition-colors ${previewOverlayMode === "full-shrink" ? "bg-purple-900/40 border-purple-500" : splitAt >= words.length ? "border-gray-600 opacity-50 cursor-not-allowed" : "border-gray-600 hover:border-gray-400"}`}
                              onClick={() => {
                                if (splitAt >= words.length) return;
                                setPreviewOverlayMode(previewOverlayMode === "full-shrink" ? null : "full-shrink");
                              }}
                              data-testid="option-full-title-shrink"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${previewOverlayMode === "full-shrink" ? "border-purple-400" : "border-gray-500"}`}>
                                  {previewOverlayMode === "full-shrink" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                                </div>
                                <span className="text-sm font-medium text-white">Full Title (Shrink Subtitle)</span>
                                <span className="text-[10px] text-gray-500 ml-auto">{splitAt < words.length ? "main large + subtitle small" : "click a word above to split"}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="bg-gray-900 rounded p-3 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">Title Size</p>
                      <span className="text-sm font-mono font-bold text-cyan-300">{previewTitleSize}%</span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={150}
                      step={5}
                      value={previewTitleSize}
                      onChange={(e) => setPreviewTitleSize(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-cyan-500 bg-gray-700"
                      data-testid="slider-title-size"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-gray-500">30% Tiny</span>
                      <span className={`text-[9px] ${previewTitleSize === 100 ? "text-cyan-400 font-bold" : "text-gray-500"}`}>100% Default</span>
                      <span className="text-[9px] text-gray-500">150% Large</span>
                    </div>
                  </div>

                  <button
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-600 text-white rounded font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={previewGeneratingOverlay || !previewDraft?.backgroundUrl || previewSavingTitle || !previewOverlayMode}
                    title={!previewDraft?.backgroundUrl ? "No clean background available" : !previewOverlayMode ? "Select a cover title option above" : "Generate AI title overlay on cover"}
                    onClick={async () => {
                      if (!previewDraft || !previewOverlayMode) return;
                      if (previewEditTitle.trim() !== previewDraft.title && previewEditTitle.trim().length > 0) {
                        try {
                          const res = await apiRequest("PATCH", `/api/content-studio/drafts/${previewDraft.id}`, {
                            title: previewEditTitle.trim(),
                          });
                          const updated = await res.json();
                          setPreviewDraft((prev) => prev ? { ...prev, title: updated.title } : null);
                          queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
                        } catch {
                          toast({ title: "Error", description: "Failed to save title before generating.", variant: "destructive" });
                          return;
                        }
                      }
                      setPreviewGeneratingOverlay(true);
                      try {
                        const titleToUse = previewEditTitle.trim() || previewDraft.title || "";
                        const titleWords = titleToUse.split(/\s+/).filter((w: string) => w.length > 0);
                        const hasCutoff = previewTitleCutoff !== null && previewTitleCutoff < titleWords.length;
                        const customMainTitle = hasCutoff ? titleWords.slice(0, previewTitleCutoff).join(" ") : titleToUse;
                        const customSubtitle = hasCutoff ? titleWords.slice(previewTitleCutoff).join(" ") : "";
                        const res = await apiRequest("POST", `/api/content-studio/ai-title-overlay/${previewDraft.id}`, {
                          mode: previewOverlayMode,
                          titleSizePercent: previewTitleSize,
                          customMainTitle,
                          customSubtitle,
                        });
                        const data = await res.json();
                        if (data.coverUrl) {
                          setPreviewDraft({ ...previewDraft, coverUrl: data.coverUrl });
                          toast({ title: "Cover updated", description: `AI title overlay applied to ID ${previewDraft.id}` });
                          queryClient.invalidateQueries({ queryKey: ["/api/content-studio/ready-for-review"] });
              queryClient.invalidateQueries({ queryKey: ["/api/content-studio/drafts", "published"] });
                        }
                      } catch {
                        toast({ title: "Error", description: "Failed to generate AI title overlay.", variant: "destructive" });
                      } finally {
                        setPreviewGeneratingOverlay(false);
                      }
                    }}
                    data-testid="button-generate-overlay"
                  >
                    {previewGeneratingOverlay ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating Cover Title...</>
                    ) : (
                      <><Wand2 className="w-4 h-4" /> Generate Cover Title</>
                    )}
                  </button>

                  {!previewOverlayMode && (
                    <p className="text-[10px] text-gray-400 text-center">Select a cover title option above to enable generation</p>
                  )}
                  {!previewDraft?.backgroundUrl && (
                    <p className="text-[10px] text-red-400 text-center">This ebook has no clean background — cannot generate title overlay</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResearchDialog} onOpenChange={(open) => { setShowResearchDialog(open); if (!open) setShowRequestPool(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-950 border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Lightbulb className="h-5 w-5 text-violet-400" />
              AI Research &amp; Create Titles
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Researches today's audience, blends approved customer requests, and creates placers with a writing brief that guides outline, dialogue, and the Story Architect when you run content later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="research-count" className="text-gray-300">How many titles?</Label>
                <Input
                  id="research-count"
                  type="number"
                  min={1}
                  max={30}
                  value={researchCount}
                  onChange={(e) => setResearchCount(Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="bg-gray-900 border-gray-600 text-white"
                  data-testid="input-research-count"
                />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="include-requests"
                    checked={includeCustomerRequests}
                    onCheckedChange={setIncludeCustomerRequests}
                    data-testid="switch-include-requests"
                  />
                  <Label htmlFor="include-requests" className="text-gray-300 cursor-pointer">
                    Include approved requests ({approvedRequests.length})
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="research-focus" className="text-gray-300">Optional focus (genre, season, audience)</Label>
              <Textarea
                id="research-focus"
                placeholder="e.g. BookTok romance, kids puzzle books, anxiety nonfiction for millennials..."
                value={researchFocusNotes}
                onChange={(e) => setResearchFocusNotes(e.target.value)}
                className="bg-gray-900 border-gray-600 text-white min-h-[72px]"
                data-testid="input-research-focus"
              />
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-between text-sm font-medium text-gray-200"
                onClick={() => setShowRequestPool(!showRequestPool)}
                data-testid="button-toggle-request-pool"
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-400" />
                  Customer Request Pool
                  {pendingRequests.length > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                      {pendingRequests.length} pending
                    </span>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showRequestPool ? "" : "-rotate-90"}`} />
              </button>
              {showRequestPool && (
                <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                  {bookRequests.length === 0 ? (
                    <p className="text-xs text-gray-500">No customer requests yet. They can submit ideas from the storefront.</p>
                  ) : (
                    bookRequests.slice(0, 20).map((req) => (
                      <div key={req.id} className="rounded border border-gray-700 bg-gray-950 p-2 text-xs">
                        <p className="text-gray-200">{req.requestText}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-gray-500">
                          <span className={`rounded px-1.5 py-0.5 ${
                            req.status === "approved" ? "bg-emerald-500/20 text-emerald-300" :
                            req.status === "rejected" ? "bg-red-500/20 text-red-300" :
                            req.status === "fulfilled" ? "bg-blue-500/20 text-blue-300" :
                            "bg-amber-500/20 text-amber-300"
                          }`}>{req.status}</span>
                          {req.suggestedGenre && <span>{req.suggestedGenre}</span>}
                          {req.customerEmail && <span>{req.customerEmail}</span>}
                        </div>
                        {req.status === "pending" && (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-emerald-500/40 text-emerald-400"
                              disabled={updateRequestMutation.isPending}
                              onClick={() => updateRequestMutation.mutate({ id: req.id, status: "approved" })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-red-500/40 text-red-400"
                              disabled={updateRequestMutation.isPending}
                              onClick={() => updateRequestMutation.mutate({ id: req.id, status: "rejected" })}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {lastResearchResult && lastResearchResult.ideas.length > 0 && (
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 space-y-2">
                <p className="text-sm font-medium text-violet-200 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Latest batch ({lastResearchResult.createdDraftIds.length} created)
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
                  {lastResearchResult.ideas.slice(0, 12).map((idea, i) => (
                    <li key={i} className="text-gray-300">
                      <span className="text-white font-medium">{idea.title}</span>
                      <span className="text-gray-500"> — {idea.genre}</span>
                      {idea.source === "customer_request" && (
                        <span className="text-amber-400 ml-1">(customer)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowResearchDialog(false)} className="border-gray-600">
              Close
            </Button>
            <Button
              onClick={() => researchTitlesMutation.mutate()}
              disabled={researchTitlesMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="button-run-research-titles"
            >
              {researchTitlesMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Researching...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Research &amp; Create {researchCount} Titles</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
