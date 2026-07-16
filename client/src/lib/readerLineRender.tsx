import React from "react";
import {
  isAsciiPuzzleLine,
  isRuledWritingLine,
  parseLabeledWritingLine,
  shouldRenderAsWorksheetLine,
  isWorksheetSectionHeader,
} from "@shared/activityBookContent";
import {
  getInstructionalSectionKind,
  isInstructionalSectionHeader,
  type InstructionalSectionKind,
} from "@shared/educationalBookQuality";

export const PUZZLE_LINE_PREFIX = "\x01PUZZLE\x01";
const WORKSHEET_RULE = "#5c4f3a";

const INSTRUCTIONAL_SECTION_COLORS: Record<
  InstructionalSectionKind,
  { bar: string; bg: string; label: string }
> = {
  objectives: { bar: "#1d4ed8", bg: "#eff6ff", label: "Objectives" },
  example: { bar: "#0f766e", bg: "#f0fdfa", label: "Example" },
  practice: { bar: "#b45309", bg: "#fffbeb", label: "Practice" },
  check: { bar: "#15803d", bg: "#f0fdf4", label: "Check" },
  keyterms: { bar: "#7e22ce", bg: "#faf5ff", label: "Key Terms" },
  review: { bar: "#334155", bg: "#f8fafc", label: "Review" },
  other: { bar: "#92400e", bg: "#fffbeb", label: "Lesson" },
};

/** Each handwriting rule ≈ 1.6 visual lines (room to write). */
export function estimateWorksheetVisualLines(line: string): number {
  if (isRuledWritingLine(line.trim())) return 1.65;
  const labeled = parseLabeledWritingLine(line);
  if (labeled) return 1.55;
  return 1.45;
}

/** Monospace estimate: ~58 chars fit in 460px at 9px. */
export function estimateAsciiPuzzleVisualLines(line: string): number {
  const t = line.startsWith(PUZZLE_LINE_PREFIX)
    ? line.slice(PUZZLE_LINE_PREFIX.length)
    : line.trim();
  const charsPerLine = 58;
  return Math.max(1, Math.ceil(t.length / charsPerLine)) * 0.85 + 0.3;
}

function RuledLine({ width = "100%" }: { width?: string | number }) {
  return (
    <span
      style={{
        display: "block",
        width,
        borderBottom: `1.5px solid ${WORKSHEET_RULE}`,
        minHeight: 26,
        marginTop: 2,
      }}
      aria-hidden
    >
      {"\u00a0"}
    </span>
  );
}

export function renderWorksheetWritingLine(
  line: string,
  keyPrefix: string,
  colors: { text: string; accent: string; heading: string },
  options: { textIndent?: number } = {},
): React.ReactNode {
  const trimmed = line.trim().replace(/^[-•]\s+/, "");
  const labeled = parseLabeledWritingLine(trimmed);

  if (labeled) {
    return (
      <div
        key={keyPrefix}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          margin: "7px 0 5px",
          paddingLeft: options.textIndent || 0,
          fontFamily: "'Libre Baskerville', Georgia, serif",
        }}
      >
        <span
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
            color: colors.text,
            paddingBottom: 5,
            minWidth: Math.min(120, labeled.label.length * 7 + 8),
          }}
        >
          {labeled.label}:
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <RuledLine />
        </span>
      </div>
    );
  }

  if (isRuledWritingLine(trimmed)) {
    return (
      <div
        key={keyPrefix}
        style={{
          margin: "6px 0 4px",
          paddingLeft: options.textIndent || 0,
        }}
      >
        <RuledLine />
      </div>
    );
  }

  // Inline label + underscore run: "Answer: ___________"
  const parts = trimmed.split(/(_{3,})/g);
  return (
    <div
      key={keyPrefix}
      style={{
        display: "flex",
        alignItems: "flex-end",
        flexWrap: "wrap",
        gap: 6,
        margin: "7px 0 5px",
        paddingLeft: options.textIndent || 0,
        fontFamily: "'Libre Baskerville', Georgia, serif",
        fontSize: 12.5,
        fontWeight: 500,
        color: colors.text,
        lineHeight: 1.5,
      }}
    >
      {parts.map((part, j) =>
        /^_{3,}$/.test(part) ? (
          <span key={j} style={{ flex: 1, minWidth: 80 }}>
            <RuledLine />
          </span>
        ) : (
          <span key={j} style={{ paddingBottom: 5, whiteSpace: "pre-wrap" }}>
            {part.replace(/\*+/g, "")}
          </span>
        ),
      )}
    </div>
  );
}

export function renderWorksheetSectionHeader(
  title: string,
  keyPrefix: string,
  colors: { text: string; accent: string; heading: string },
): React.ReactNode {
  const fillMatch = title.match(/^(.+?)\s*(\(fill this in\))\s*$/i);
  const main = fillMatch ? fillMatch[1].trim() : title;
  const hint = fillMatch ? fillMatch[2] : null;

  return (
    <div
      key={keyPrefix}
      style={{
        marginTop: 14,
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: `2px solid ${colors.accent}55`,
      }}
    >
      <div
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 15,
          fontWeight: 700,
          color: colors.heading,
          letterSpacing: 0.3,
        }}
      >
        {main}
        {hint && (
          <span
            style={{
              fontFamily: "'Libre Baskerville', Georgia, serif",
              fontSize: 11,
              fontWeight: 400,
              fontStyle: "italic",
              color: colors.text,
              opacity: 0.75,
              marginLeft: 6,
            }}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

/** Schoolbook / digital HQIM section chrome — objectives, practice, checks, etc. */
export function renderInstructionalSectionHeader(
  title: string,
  keyPrefix: string,
  kind?: InstructionalSectionKind | null,
): React.ReactNode {
  const resolved = kind || getInstructionalSectionKind(title) || "other";
  const palette = INSTRUCTIONAL_SECTION_COLORS[resolved];

  return (
    <div
      key={keyPrefix}
      role="heading"
      aria-level={3}
      style={{
        marginTop: 8,
        marginBottom: 4,
        padding: "6px 10px",
        borderLeft: `4px solid ${palette.bar}`,
        backgroundColor: palette.bg,
        borderRadius: "0 6px 6px 0",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: palette.bar,
          marginBottom: 1,
          fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
        }}
      >
        {palette.label}
      </div>
      <div
        style={{
          fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
          fontSize: 14,
          fontWeight: 700,
          color: "#1e293b",
          letterSpacing: 0.2,
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
    </div>
  );
}

export function isInstructionalHeaderLine(line: string): boolean {
  const t = line.trim();
  if (!/^#{2,}\s/.test(t) && !/^\*\*[^*]+\*\*\s*$/.test(t)) return false;
  return isInstructionalSectionHeader(t);
}

export function renderAsciiPuzzleLine(
  line: string,
  idx: number,
  pageAccent: string,
  pageText: string,
): React.ReactNode {
  const raw = line.startsWith(PUZZLE_LINE_PREFIX)
    ? line.slice(PUZZLE_LINE_PREFIX.length)
    : line;
  return (
    <pre
      key={idx}
      style={{
        fontFamily: "'Courier New', Consolas, monospace",
        fontSize: 9,
        lineHeight: 1.15,
        letterSpacing: 0,
        margin: "4px 0 6px",
        padding: "6px 8px",
        backgroundColor: `${pageAccent}0c`,
        border: `1px solid ${pageAccent}33`,
        borderRadius: 4,
        color: pageText,
        whiteSpace: "pre",
        overflowX: "auto",
        maxWidth: "100%",
      }}
    >
      {raw}
    </pre>
  );
}

export function shouldRenderAsPuzzleLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.startsWith(PUZZLE_LINE_PREFIX)) return true;
  return isAsciiPuzzleLine(trimmed);
}

export function shouldRenderAsFillIn(line: string): boolean {
  return shouldRenderAsWorksheetLine(line);
}

export { shouldRenderAsWorksheetLine };

export function isWorksheetHeaderLine(line: string): boolean {
  const t = line.trim();
  if (!/^#{2,}\s/.test(t) && !/^\*\*[^*]+\*\*\s*$/.test(t)) return false;
  const plain = t.replace(/^#{1,6}\s+/, "").replace(/\*+/g, "").trim();
  return isWorksheetSectionHeader(plain);
}

export function estimateWorksheetOrFillInLines(line: string): number {
  if (shouldRenderAsWorksheetLine(line)) return estimateWorksheetVisualLines(line);
  return 1.45;
}
