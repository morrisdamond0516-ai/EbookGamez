/**
 * Bidirectional story ↔ cover coordination.
 * - Cover-first: block new story/dialogue until a publishable cover exists.
 * - Story-aware covers: when outline/content already exist, feed them into cover AI prompts.
 */
import { draftHasPublishableCover } from "./coverStorage";

export type DraftStoryCoverFields = {
  id?: number;
  title?: string | null;
  topic?: string | null;
  genre?: string | null;
  description?: string | null;
  outline?: string | null;
  content?: string | null;
  coverUrl?: string | null;
  backgroundUrl?: string | null;
  status?: string | null;
};

export type StoryWritingGateResult = {
  allowed: boolean;
  reason: string;
  mode: "blocked" | "resume" | "cover-first";
};

const MIN_RESUME_WORDS = 3000;
const MIN_RESUME_CHAPTERS = 2;
const OUTLINE_MIN_CHARS = 200;

/** Enough written material to resume without re-enforcing cover-first (e.g. #723–#728). */
export function draftHasSubstantialStoryProgress(draft: DraftStoryCoverFields): boolean {
  const content = draft.content?.trim() || "";
  if (!content || content.length < 500) return false;
  const words = content.split(/\s+/).length;
  const chapters = (content.match(/##\s*Chapter\s+\d+/gi) || []).length;
  if (words >= MIN_RESUME_WORDS && chapters >= MIN_RESUME_CHAPTERS) return true;
  if (draft.status === "generating" && words >= 1500) return true;
  return false;
}

export function draftHasSatisfactoryOutline(draft: DraftStoryCoverFields): boolean {
  const outline = draft.outline?.trim() || "";
  if (outline.length < OUTLINE_MIN_CHARS) return false;
  return (
    outline.includes("Story Architect") ||
    /##\s*(Title|Premise|Hook|Chapter)/i.test(outline)
  );
}

/** Gate new story/dialogue until cover exists; allow resume for books already in progress. */
export function checkStoryWritingGate(draft: DraftStoryCoverFields): StoryWritingGateResult {
  if (draftHasSubstantialStoryProgress(draft)) {
    return {
      allowed: true,
      reason: "Story already in progress — resume allowed",
      mode: "resume",
    };
  }

  if (!draftHasPublishableCover(draft)) {
    return {
      allowed: false,
      reason:
        "Cover-first workflow: create and save a cover in Cover Review before outline cross-exam and story/dialogue writing.",
      mode: "blocked",
    };
  }

  return {
    allowed: true,
    reason: "Publishable cover present — outline cross-exam will run before chapter writing",
    mode: "cover-first",
  };
}

export function assertDraftReadyForStoryWriting(draft: DraftStoryCoverFields): void {
  const gate = checkStoryWritingGate(draft);
  if (!gate.allowed) {
    throw new Error(gate.reason);
  }
}

function extractOutlineExcerpt(outline: string, maxChars = 2200): string {
  const cleaned = outline
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= maxChars) return cleaned;

  const premiseMatch = cleaned.match(/##\s*Premise[\s\S]*?(?=\n##|\n$)/i);
  const hookMatch = cleaned.match(/##\s*Hook[\s\S]*?(?=\n##|\n$)/i);
  const chapterTitles = [...cleaned.matchAll(/##\s*Chapter\s+\d+[:\s—–-]*([^\n]+)/gi)]
    .slice(0, 12)
    .map((m) => `- ${m[0].replace(/^##\s*/, "").trim()}`);

  const parts = [
    premiseMatch?.[0]?.trim(),
    hookMatch?.[0]?.trim(),
    chapterTitles.length ? `Chapter arc:\n${chapterTitles.join("\n")}` : "",
    cleaned.substring(0, 800),
  ].filter(Boolean);

  return parts.join("\n\n").substring(0, maxChars);
}

function extractDialogueSamples(content: string, maxLines = 8): string[] {
  const lines = content.split("\n");
  const samples: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const quoteCount = (trimmed.match(/["“”']/g) || []).length;
    if (quoteCount >= 2 || (quoteCount >= 1 && trimmed.length > 20 && trimmed.length < 220)) {
      samples.push(trimmed);
      if (samples.length >= maxLines) break;
    }
  }
  return samples;
}

function extractStoryOpening(content: string, maxWords = 180): string {
  const withoutMarkers = content.replace(/\[ILLUSTRATION:[^\]]*\]/gi, "").trim();
  const firstChapter = withoutMarkers.match(/##\s*Chapter\s+1[\s\S]*?(?=##\s*Chapter\s+2|$)/i);
  const text = (firstChapter?.[0] || withoutMarkers).replace(/^##\s*Chapter\s+\d+[^\n]*\n?/i, "");
  const words = text.split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

/** Deterministic story/outline context for cover AI prompts (no extra LLM call). */
export function buildStoryContextForCover(draft: DraftStoryCoverFields): string {
  const parts: string[] = [];
  const title = draft.title || draft.topic || "Untitled";
  const outline = draft.outline?.trim();
  const content = draft.content?.trim();

  if (outline && outline.length > 80) {
    parts.push(`OUTLINE (visualize this story world):\n${extractOutlineExcerpt(outline)}`);
  }

  if (content && content.length > 400) {
    const opening = extractStoryOpening(content);
    if (opening) {
      parts.push(`OPENING PROSE (tone & setting to match on cover):\n${opening}`);
    }
    const dialogue = extractDialogueSamples(content);
    if (dialogue.length) {
      parts.push(`DIALOGUE SAMPLES (character voice & conflict):\n${dialogue.join("\n")}`);
    }
    const words = content.split(/\s+/).length;
    const chapters = (content.match(/##\s*Chapter\s+\d+/gi) || []).length;
    parts.push(`Manuscript status: ~${words} words, ${chapters} chapter(s) already written for "${title}".`);
  }

  return parts.join("\n\n");
}

export function draftHasStoryForCoverSync(draft: DraftStoryCoverFields): boolean {
  const ctx = buildStoryContextForCover(draft);
  return ctx.length > 120;
}

/**
 * Rich creative brief for cover generation — merges research brief, outline, and written story.
 * Import getCreativeDirectionForDraft from contentStudio at call site to avoid circular deps.
 */
export function mergeCoverCreativeBrief(
  baseCreativeDirection: string,
  draft: DraftStoryCoverFields,
): string {
  const storyBlock = buildStoryContextForCover(draft);
  if (!storyBlock) return baseCreativeDirection;

  const mode = draftHasSubstantialStoryProgress(draft)
    ? "STORY-FIRST ADAPTATION"
    : "OUTLINE-AWARE COVER";

  return [
    baseCreativeDirection,
    "",
    `=== ${mode}: cover must align with existing manuscript material ===`,
    storyBlock,
    "",
    "Cover imagery, mood, palette, and focal subject must reflect the outline and written story above — not just the title alone.",
  ]
    .filter(Boolean)
    .join("\n");
}
