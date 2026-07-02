import { useState, useRef, useCallback, forwardRef, useEffect } from "react";
import HTMLFlipBook from "react-pageflip";
import { X, ChevronLeft, ChevronRight, Lock, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

// ─── Layout constants (mirror book-reader.tsx) ───────────────────────────────
const PAGE_WIDTH_PX   = 500;
const PAGE_HEIGHT_PX  = 680;
const CONTENT_PAD_TOP    = 16;
const CONTENT_PAD_SIDE   = 20;
const CONTENT_PAD_BOTTOM = 28;
const CONTENT_WIDTH_PX   = PAGE_WIDTH_PX  - CONTENT_PAD_SIDE * 2;
const CONTENT_HEIGHT_PX  = PAGE_HEIGHT_PX - CONTENT_PAD_TOP - CONTENT_PAD_BOTTOM;
const RUNNING_TITLE_PX   = 26;
const LAYOUT_SAFE_PX     = 20;
const NET_CONTENT_PX     = CONTENT_HEIGHT_PX - RUNNING_TITLE_PX - LAYOUT_SAFE_PX;
const BODY_FONT_PX       = 12.5;
const BODY_LINE_HEIGHT   = 1.65;
const PX_PER_LINE        = BODY_FONT_PX * BODY_LINE_HEIGHT;
const MAX_VISUAL_LINES   = 29;
const HEADER_PX_PER_LINE = 16 * 1.25;
const HEADER_MARGIN_PX   = 12 + 8;
const HEADER_CHARS_PER_LINE = 44;
const HEADER_LINE_COST   = HEADER_PX_PER_LINE / PX_PER_LINE;
const HEADER_MARGIN_COST = HEADER_MARGIN_PX   / PX_PER_LINE;
const PX_PER_CHAR_REGULAR = 6.5;
const PX_PER_CHAR_WIDE    = 7.5;
const CONTENT_PX_BODY     = 460;
const CONTENT_PX_INDENTED = 440;
const CONTENT_PX_TEXTINDENT = 20;
const CHARS_PER_LINE_TABLE  = 60;
const BLANK_DIV_HEIGHT_PX   = 8;
const CONT_PREFIX = "\x01CONT\x01";

const PAGE_BG     = "#faf6ed";
const PAGE_TEXT   = "#000000";
const PAGE_ACCENT = "#4a3a28";
const PAGE_HEADING = "#000000";

// ─── Genre colours (same as book-reader) ─────────────────────────────────────
const GENRE_COLORS: Record<string, { spine: string; coverBg: string; coverText: string; accent: string }> = {
  "Romance":           { spine: "#6b1d3a", coverBg: "#4a1528", coverText: "#f4c2d0", accent: "#e8446a" },
  "Horror":            { spine: "#2a0a0a", coverBg: "#1a0808", coverText: "#d4a0a0", accent: "#dc2626" },
  "Science Fiction":   { spine: "#0a2540", coverBg: "#081c30", coverText: "#a0d4e8", accent: "#22d3ee" },
  "Fantasy":           { spine: "#3a2508", coverBg: "#2a1a05", coverText: "#e8d4a0", accent: "#f59e0b" },
  "Mystery":           { spine: "#1a1a3a", coverBg: "#121230", coverText: "#b0b0e0", accent: "#818cf8" },
  "Thriller":          { spine: "#1a1028", coverBg: "#140c20", coverText: "#c0a8e0", accent: "#a78bfa" },
  "Historical Fiction":{ spine: "#3a2010", coverBg: "#2a1808", coverText: "#e0c8a0", accent: "#ea580c" },
  "Literary Fiction":  { spine: "#2a2520", coverBg: "#1e1a18", coverText: "#c8c0b8", accent: "#a8a29e" },
  "Self-Help":         { spine: "#0a3020", coverBg: "#082518", coverText: "#a0e0c0", accent: "#34d399" },
  "Psychology":        { spine: "#2a1840", coverBg: "#1e1030", coverText: "#c0a8e8", accent: "#a78bfa" },
  "Business & Finance":{ spine: "#0a2040", coverBg: "#081830", coverText: "#a0c8e8", accent: "#60a5fa" },
  "Health & Wellness": { spine: "#0a2a28", coverBg: "#082020", coverText: "#a0e0d8", accent: "#2dd4bf" },
  "Spirituality":      { spine: "#2a1838", coverBg: "#1e1028", coverText: "#d0a8f0", accent: "#c084fc" },
  "Productivity":      { spine: "#1a2a10", coverBg: "#142008", coverText: "#c0e0a0", accent: "#84cc16" },
  "Classic Literature":{ spine: "#3a2508", coverBg: "#2a1a05", coverText: "#e8d4a0", accent: "#d4a853" },
};
const DEFAULT_COLORS = { spine: "#3a2508", coverBg: "#2a1a05", coverText: "#e8d4a0", accent: "#f59e0b" };
function getGenreColors(genre: string) { return GENRE_COLORS[genre] || DEFAULT_COLORS; }

// ─── Line-cost estimator ──────────────────────────────────────────────────────
function estimateVisualLines(line: string): number {
  const trimmed = line.trim();
  if (trimmed === "") return BLANK_DIV_HEIGHT_PX / PX_PER_LINE;

  // Illustration markers with a resolved URL take a full page
  const illustMatch = trimmed.match(/\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):\s*(.+?)\]/i);
  if (illustMatch) {
    const src = illustMatch[1].split(' | ')[0].trim();
    if (src.startsWith("/") || src.startsWith("http")) return MAX_VISUAL_LINES;
    return 2; // placeholder marker — treat as two lines
  }

  const headerMatch = trimmed.match(/^#{2,}\s*\**\s*(.+?)\s*\**\s*$/);
  if (headerMatch) {
    const wrapped = Math.ceil(headerMatch[1].length / HEADER_CHARS_PER_LINE) || 1;
    return wrapped * HEADER_LINE_COST + HEADER_MARGIN_COST;
  }

  const isBullet   = trimmed.startsWith("- ") || trimmed.startsWith("\u2022 ");
  const isTableRow = trimmed.startsWith("|");
  const isDialogue = trimmed.startsWith('"') || trimmed.startsWith('\u201c') || trimmed.startsWith("'");

  if (isTableRow) {
    return Math.ceil(trimmed.length / CHARS_PER_LINE_TABLE) + 0.2;
  }

  const underscores = (trimmed.match(/_/g) || []).length;
  const normalChars = trimmed.length - underscores;
  const estimatedPx = underscores * PX_PER_CHAR_WIDE + normalChars * PX_PER_CHAR_REGULAR;

  let wrapped: number;
  if (isBullet || isDialogue) {
    wrapped = Math.ceil(estimatedPx / CONTENT_PX_INDENTED);
  } else {
    wrapped = Math.ceil((estimatedPx + CONTENT_PX_TEXTINDENT) / CONTENT_PX_BODY);
  }
  return wrapped + 0.2;
}

function splitParagraphAtSentences(para: string, maxLines: number): string[] {
  const sentenceRe = /[^.!?…]+[.!?…]+[""')\]]*\s*/g;
  const rawSentences = para.match(sentenceRe);
  const sentences = rawSentences ? rawSentences.map(s => s.trim()).filter(Boolean) : [para];

  if (sentences.length <= 1) {
    const words = para.split(/\s+/);
    const chunks: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? current + " " + word : word;
      if (estimateVisualLines(candidate) > maxLines && current) {
        chunks.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? current + " " + sentence : sentence;
    if (estimateVisualLines(candidate) > maxLines && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function splitIntoPages(text: string): string[][] {
  const rawLines = text.split("\n");
  const lines: string[] = [];
  let prevWasEmpty = false;
  for (const l of rawLines) {
    const isEmpty = l.trim() === "";
    if (isEmpty && prevWasEmpty) continue;
    lines.push(l);
    prevWasEmpty = isEmpty;
  }

  const pages: string[][] = [];
  let currentPage: string[] = [];
  let visualCount = 0;
  const maxLines = MAX_VISUAL_LINES;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === "" && currentPage.length === 0) continue;
    const cost = estimateVisualLines(trimmedLine);
    const isDecorativeLine = cost <= 1.5 && !trimmedLine.match(/[a-zA-Z0-9_]/);

    if (cost > maxLines) {
      if (currentPage.length > 0) {
        pages.push([...currentPage]);
        currentPage = [];
        visualCount = 0;
      }
      const chunks = splitParagraphAtSentences(trimmedLine, maxLines);
      for (let ci = 0; ci < chunks.length - 1; ci++) {
        pages.push([ci === 0 ? chunks[ci] : CONT_PREFIX + chunks[ci]]);
      }
      const lastChunkRaw = chunks[chunks.length - 1];
      currentPage = [chunks.length === 1 ? lastChunkRaw : CONT_PREFIX + lastChunkRaw];
      visualCount = estimateVisualLines(lastChunkRaw);
      continue;
    }

    if (visualCount + cost > maxLines && currentPage.length > 0 &&
        (!isDecorativeLine || visualCount > maxLines)) {
      pages.push([...currentPage]);
      currentPage = [];
      visualCount = 0;
    }
    if (trimmedLine === "" && currentPage.length === 0) continue;
    currentPage.push(trimmedLine);
    visualCount += cost;
  }
  if (currentPage.length > 0) {
    const hasContent = currentPage.some(l => {
      const t = l.startsWith(CONT_PREFIX) ? l.slice(CONT_PREFIX.length).trim() : l.trim();
      return t !== "";
    });
    if (hasContent) pages.push(currentPage);
  }
  return pages;
}

function IllustrationImage({ src, caption }: { src: string; caption?: string | null }) {
  const [errored, setErrored] = useState(false);
  if (errored) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", marginTop: 8, marginBottom: 8 }}>
      <img
        src={src}
        alt={caption || "Illustration"}
        onError={() => setErrored(true)}
        style={{ maxWidth: "96%", maxHeight: 560, objectFit: "contain", borderRadius: 4 }}
      />
      {caption && (
        <p style={{ fontSize: 10, fontStyle: "italic", color: PAGE_TEXT, opacity: 0.6, textAlign: "center", marginTop: 4, fontFamily: "'Libre Baskerville', serif", lineHeight: 1.4 }}>
          {caption}
        </p>
      )}
    </div>
  );
}

function renderContentLine(line: string, idx: number) {
  const raw = line.trim();
  const isContinuation = raw.startsWith(CONT_PREFIX);
  const trimmed = isContinuation ? raw.slice(CONT_PREFIX.length).trim() : raw;
  const paraIndent = isContinuation ? 0 : 20;

  if (trimmed === "") return <div key={idx} style={{ height: 8 }} />;

  // Render illustration markers as images
  const illustMatch = trimmed.match(/\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):\s*(.+?)\]/i);
  if (illustMatch) {
    const fullSrc = illustMatch[1].trim();
    const pipeIdx = fullSrc.indexOf(' | ');
    const src = pipeIdx >= 0 ? fullSrc.substring(0, pipeIdx).trim() : fullSrc;
    const caption = pipeIdx >= 0 ? fullSrc.substring(pipeIdx + 3).trim() : null;
    if (src.startsWith("/") || src.startsWith("http")) {
      return <IllustrationImage key={idx} src={src} caption={caption} />;
    }
    return null; // unresolved placeholder — skip
  }

  const subMatch = trimmed.match(/^#{2,}\s*\**\s*(.+?)\s*\**\s*$/);
  if (subMatch) {
    return (
      <h3 key={idx} style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 700, color: PAGE_HEADING, marginTop: 12, marginBottom: 8 }}>
        {subMatch[1].replace(/\*+/g, "").replace(/^#+\s*/, "").trim()}
      </h3>
    );
  }

  const isDialogue = trimmed.startsWith('"') || trimmed.startsWith('\u201c') || trimmed.startsWith("'");
  const isBullet   = trimmed.startsWith("- ") || trimmed.startsWith("\u2022 ");
  const isItalicLine = trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**");

  let cleanLine = trimmed.replace(/^\*\*(.+?)\*\*$/, "$1").replace(/\*\*(.+?)\*\*/g, "$1");

  if (isBullet) {
    return (
      <p key={idx} style={{ paddingLeft: 20, marginBottom: 3, lineHeight: 1.65, position: "relative", fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 12.5, fontWeight: 500, color: PAGE_TEXT }}>
        <span style={{ position: "absolute", left: 6, color: PAGE_ACCENT }}>{"\u2022"}</span>
        {cleanLine.replace(/^[-\u2022]\s*/, "")}
      </p>
    );
  }

  if (isDialogue) {
    return (
      <p key={idx} style={{ paddingLeft: 16, marginBottom: 4, lineHeight: 1.65, color: PAGE_TEXT, fontStyle: "italic", fontWeight: 500, fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 12.5 }}>
        {cleanLine}
      </p>
    );
  }

  if (isItalicLine) {
    return (
      <p key={idx} style={{ marginBottom: 4, lineHeight: 1.65, fontStyle: "italic", textAlign: "center", fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 12.5, fontWeight: 500, color: PAGE_TEXT }}>
        {cleanLine.replace(/^\*|\*$/g, "")}
      </p>
    );
  }

  const hasInlineEmphasis = cleanLine.includes("*");
  if (hasInlineEmphasis) {
    const parts = cleanLine.split(/(\*[^*]+\*)/g);
    return (
      <p key={idx} style={{ marginBottom: 4, lineHeight: 1.65, textAlign: "justify", textIndent: paraIndent, fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 12.5, fontWeight: 500, color: PAGE_TEXT }}>
        {parts.map((part, j) =>
          part.startsWith("*") && part.endsWith("*")
            ? <em key={j}>{part.slice(1, -1)}</em>
            : <span key={j}>{part}</span>
        )}
      </p>
    );
  }

  return (
    <p key={idx} style={{ marginBottom: 4, lineHeight: 1.65, textAlign: "justify", textIndent: paraIndent, fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 12.5, fontWeight: 500, color: PAGE_TEXT }}>
      {cleanLine}
    </p>
  );
}

// ─── BookPage ─────────────────────────────────────────────────────────────────
const BookPage = forwardRef<HTMLDivElement, {
  children: React.ReactNode;
  pageNum?: number;
  totalPages?: number;
  isHardCover?: boolean;
  hardCoverStyle?: React.CSSProperties;
}>(({ children, pageNum, totalPages, isHardCover, hardCoverStyle }, ref) => {
  if (isHardCover) {
    return (
      <div ref={ref} data-density="hard" style={{ width: "100%", height: "100%", ...hardCoverStyle }}>
        {children}
      </div>
    );
  }
  return (
    <div ref={ref} style={{ backgroundColor: "#ffffff", color: "#111111", colorScheme: "light", width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column", colorScheme: "light", backgroundColor: "#ffffff" }}>
        {children}
      </div>
      {pageNum != null && totalPages && (
        <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", fontSize: 11, color: PAGE_ACCENT, opacity: 0.7, fontWeight: 500, fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          {pageNum}
        </div>
      )}
    </div>
  );
});

// ─── CTA page (last page of the preview) ─────────────────────────────────────
const LockedCtaPage = forwardRef<HTMLDivElement, {
  title: string;
  genre: string;
  price: string | null;
  bookId: number;
  onBuy: () => void;
}>(({ title, genre, price, bookId, onBuy }, ref) => {
  const gc = getGenreColors(genre);

  const headlines: Record<string, { teaser: string; hook: string }> = {
    "Romance":           { teaser: "Their hearts are about to collide in ways neither one saw coming.", hook: "You felt it. That pull. Don't stop now." },
    "Horror":            { teaser: "The worst is still ahead — and you can't look away.", hook: "You're already afraid. That means it's working." },
    "Science Fiction":   { teaser: "The truth about what's really out there will change everything.", hook: "The universe just got bigger. Keep reading." },
    "Fantasy":           { teaser: "The real magic begins in the next chapter.", hook: "Every great quest starts right where you just left off." },
    "Mystery":           { teaser: "You already have a suspect. You're probably wrong.", hook: "The clues are all there. Keep turning pages." },
    "Thriller":          { teaser: "The clock is ticking and the stakes just doubled.", hook: "Heart pounding? Good. It gets worse." },
    "Self-Help":         { teaser: "The insight that actually changes things comes next.", hook: "This is the part most people never get to." },
    "Psychology":        { teaser: "What comes next will make you see yourself differently.", hook: "The real revelation is one chapter away." },
    "Business & Finance":{ teaser: "The strategy most people miss is in the next section.", hook: "You're one chapter from thinking like the top 1%." },
  };

  const fallback = { teaser: "The story is just getting started.", hook: "You're hooked — and you know it." };
  const { teaser, hook } = headlines[genre] || fallback;

  return (
    <div
      ref={ref}
      data-density="hard"
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(160deg, ${gc.coverBg} 0%, ${gc.spine} 60%, #000 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 28px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle radial glow */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 30%, ${gc.accent}22 0%, transparent 70%)`, pointerEvents: "none" }} />

      {/* Lock icon */}
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${gc.accent}22`, border: `1.5px solid ${gc.accent}55`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Lock style={{ width: 22, height: 22, color: gc.accent }} />
      </div>

      {/* Genre-specific teaser */}
      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontStyle: "italic", color: gc.coverText, textAlign: "center", lineHeight: 1.6, marginBottom: 10, opacity: 0.85 }}>
        "{teaser}"
      </p>

      {/* Hook line */}
      <p style={{ fontFamily: "'Cinzel', serif", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: gc.accent, textAlign: "center", marginBottom: 28 }}>
        {hook}
      </p>

      {/* Divider */}
      <div style={{ width: 48, height: 1, background: `${gc.accent}60`, marginBottom: 28 }} />

      {/* Chapter end banner */}
      <div style={{ background: `${gc.accent}18`, border: `1px solid ${gc.accent}40`, borderRadius: 10, padding: "14px 20px", textAlign: "center", marginBottom: 24, width: "100%" }}>
        <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: gc.accent, marginBottom: 6 }}>
          End of free preview
        </p>
        <p style={{ fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: 12, color: gc.coverText, lineHeight: 1.5, opacity: 0.9 }}>
          <strong style={{ color: gc.accent }}>"{title}"</strong> continues with chapters, plot twists, and moments that will stay with you long after the last page.
        </p>
      </div>

      {/* Price + CTA */}
      <button
        onClick={onBuy}
        style={{
          background: `linear-gradient(135deg, ${gc.accent}, ${gc.accent}cc)`,
          color: "#fff",
          border: "none",
          borderRadius: 10,
          padding: "14px 28px",
          fontSize: 14,
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          cursor: "pointer",
          width: "100%",
          letterSpacing: 0.5,
          boxShadow: `0 4px 20px ${gc.accent}55`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <ShoppingCart style={{ width: 16, height: 16 }} />
        Get the Full Book{price ? ` — $${price}` : ""}
      </button>

      <p style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 10, color: gc.coverText, opacity: 0.5, textAlign: "center" }}>
        DRM-free · instant access · yours forever
      </p>
    </div>
  );
});

// ─── Main export ─────────────────────────────────────────────────────────────
interface PreviewData {
  title: string;
  chapterTitle: string;
  content: string;
  totalWords: number;
  coverUrl: string | null;
  genre: string;
  price: string | null;
  previewPageLimit: number | null;
}

interface FlipbookPreviewProps {
  bookId: number;
  onClose: () => void;
  onBuy: () => void;
}

export default function FlipbookPreview({ bookId, onClose, onBuy }: FlipbookPreviewProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  // Recalculate scale on resize / orientation change
  const calcScale = () => {
    const availW = window.innerWidth - 32;
    // On small screens also cap height so the nav buttons stay visible
    const availH = window.innerHeight - 180;
    const byWidth  = availW / PAGE_WIDTH_PX;
    const byHeight = availH / PAGE_HEIGHT_PX;
    return Math.min(1, byWidth, byHeight);
  };
  const [scale, setScale] = useState(calcScale);
  const flipRef = useRef<any>(null);

  // Fetch preview data
  useEffect(() => {
    fetch(`/api/books/${bookId}/preview`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setPreview(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [bookId]);

  // Update scale + isMobile on resize/rotation
  useEffect(() => {
    const handleResize = () => {
      setScale(calcScale());
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const allPages = preview ? splitIntoPages(preview.content) : [];
  // Respect previewPageLimit for non-chapter books (e.g. coloring books = 5 pages)
  const pages = preview?.previewPageLimit != null
    ? allPages.slice(0, preview.previewPageLimit)
    : allPages;
  // Total flipbook pages: front cover + content pages + locked CTA page
  const totalFlipPages = 1 + pages.length + 1;

  const goBack  = useCallback(() => { flipRef.current?.pageFlip()?.flipPrev("bottom"); }, []);
  const goNext  = useCallback(() => { flipRef.current?.pageFlip()?.flipNext("bottom"); }, []);

  const genreColors = preview ? getGenreColors(preview.genre) : DEFAULT_COLORS;

  const coverStyle: React.CSSProperties = {
    background: `linear-gradient(145deg, ${genreColors.coverBg}, ${genreColors.spine})`,
    borderRadius: "3px",
    overflow: "hidden",
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center"
      style={{ background: "radial-gradient(ellipse at center, #3a3028 0%, #1a1410 70%)" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)" }}>
        <div className="min-w-0 flex-1 mr-2">
          <p style={{ fontFamily: "'Cinzel', serif", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: genreColors.accent, marginBottom: 1 }}>
            Free Preview
          </p>
          {preview && (
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 12 : 14, color: "#e5d8c8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {preview.title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {preview && (
            <span style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 10, color: "#8a7a6a" }}>
              {currentPage + 1}/{totalFlipPages}
            </span>
          )}
          {/* Large touch target for close */}
          <button
            onClick={onClose}
            style={{ color: "#c0a882", padding: "10px", margin: "-10px -8px -10px 0", cursor: "pointer" }}
            data-testid="button-close-flipbook-preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chapter label */}
      {preview && (
        <div className="mb-2 mt-14 text-center px-4">
          <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: genreColors.accent }}>
            {preview.chapterTitle}
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-4 mt-20">
          <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 13, color: "#6a5a4a" }}>
            Opening the book...
          </p>
        </div>
      )}

      {/* No preview */}
      {!loading && !preview && (
        <div className="flex flex-col items-center gap-4 mt-20">
          <p style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 14, color: "#8a7a6a" }}>
            No preview available for this book yet.
          </p>
          <button onClick={onClose} className="px-5 py-2 rounded-lg border border-white/10 text-sm text-stone-400 hover:text-white transition-colors">
            Close
          </button>
        </div>
      )}

      {/* Flipbook */}
      {!loading && preview && pages.length > 0 && (
        <div
          style={{
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top center",
            height: scale < 1 ? `${Math.ceil(PAGE_HEIGHT_PX * scale + 8)}px` : undefined,
          }}
        >
          <HTMLFlipBook
            ref={flipRef}
            width={PAGE_WIDTH_PX}
            height={PAGE_HEIGHT_PX}
            size="fixed"
            minWidth={PAGE_WIDTH_PX}
            maxWidth={PAGE_WIDTH_PX}
            minHeight={PAGE_HEIGHT_PX}
            maxHeight={PAGE_HEIGHT_PX}
            maxShadowOpacity={0.06}
            showCover={true}
            mobileScrollSupport={true}
            useMouseEvents={true}
            onFlip={(e: any) => setCurrentPage(e.data)}
            className=""
            style={{ colorScheme: "light" } as any}
            startPage={0}
            drawShadow={false}
            flippingTime={600}
            usePortrait={true}
            startZIndex={20}
            autoSize={false}
            clickEventForward={true}
            swipeDistance={30}
            showPageCorners={true}
            disableFlipByClick={false}
          >
            {/* ── Front cover ── */}
            <BookPage isHardCover hardCoverStyle={coverStyle}>
              {preview.coverUrl ? (
                <img
                  src={preview.coverUrl}
                  alt={preview.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 700, color: genreColors.coverText, textAlign: "center", lineHeight: 1.4, marginBottom: 16 }}>
                    {preview.title}
                  </p>
                  <div style={{ width: 40, height: 1, background: `${genreColors.accent}80`, marginBottom: 12 }} />
                  <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: genreColors.accent }}>
                    {preview.genre}
                  </p>
                </div>
              )}
            </BookPage>

            {/* ── Content pages ── */}
            {pages.map((pageLines, pi) => (
              <BookPage key={pi} pageNum={pi + 1} totalPages={pages.length}>
                <div style={{ padding: `${CONTENT_PAD_TOP}px ${CONTENT_PAD_SIDE}px ${CONTENT_PAD_BOTTOM}px` }}>
                  {/* Running title */}
                  <div style={{ fontSize: 10, fontFamily: "'Cinzel', serif", letterSpacing: 2, textTransform: "uppercase", color: PAGE_ACCENT, opacity: 0.6, marginBottom: 12, textAlign: "center" }}>
                    {preview.chapterTitle}
                  </div>
                  {pageLines.map((line, li) => renderContentLine(line, li))}
                </div>
              </BookPage>
            ))}

            {/* ── Locked CTA page ── */}
            <LockedCtaPage
              title={preview.title}
              genre={preview.genre}
              price={preview.price}
              bookId={bookId}
              onBuy={onBuy}
            />
          </HTMLFlipBook>
        </div>
      )}

      {/* Nav buttons */}
      {!loading && preview && (
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={goBack}
            disabled={currentPage === 0}
            style={{
              padding: isMobile ? "14px" : "10px",
              borderRadius: "50%",
              border: `1px solid ${genreColors.accent}40`,
              color: genreColors.accent,
              background: `${genreColors.accent}10`,
              opacity: currentPage === 0 ? 0.2 : 1,
              cursor: currentPage === 0 ? "default" : "pointer",
              transition: "opacity 0.2s",
              minWidth: isMobile ? 48 : 40,
              minHeight: isMobile ? 48 : 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            data-testid="button-preview-prev"
          >
            <ChevronLeft style={{ width: isMobile ? 22 : 18, height: isMobile ? 22 : 18 }} />
          </button>

          <button
            onClick={onBuy}
            style={{
              padding: isMobile ? "12px 20px" : "9px 20px",
              borderRadius: 12,
              fontSize: isMobile ? 14 : 13,
              fontWeight: 600,
              background: genreColors.accent,
              color: "#fff",
              fontFamily: "'Playfair Display', serif",
              boxShadow: `0 4px 16px ${genreColors.accent}55`,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            data-testid="button-preview-buy-bottom"
          >
            Get the Full Book
          </button>

          <button
            onClick={goNext}
            disabled={currentPage >= totalFlipPages - 1}
            style={{
              padding: isMobile ? "14px" : "10px",
              borderRadius: "50%",
              border: `1px solid ${genreColors.accent}40`,
              color: genreColors.accent,
              background: `${genreColors.accent}10`,
              opacity: currentPage >= totalFlipPages - 1 ? 0.2 : 1,
              cursor: currentPage >= totalFlipPages - 1 ? "default" : "pointer",
              transition: "opacity 0.2s",
              minWidth: isMobile ? 48 : 40,
              minHeight: isMobile ? 48 : 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            data-testid="button-preview-next"
          >
            <ChevronRight style={{ width: isMobile ? 22 : 18, height: isMobile ? 22 : 18 }} />
          </button>
        </div>
      )}

      {/* Bottom hint */}
      {!loading && preview && currentPage === 0 && (
        <p className="mt-2 text-center px-4" style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 10, color: "#4a3a28" }}>
          {isMobile ? "Swipe the page or use the arrows" : "Click the page corner or use the arrows to read"}
        </p>
      )}
    </div>
  );
}
