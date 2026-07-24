/**
 * When an AI-authored draft title collides with an external book:
 * propose a new original title → rename draft → regenerate cover the same way
 * (same Cover Review model-style tools via coverStyleId) → overlay → republish.
 *
 * Keeps production moving without manual one-off renames.
 */
import OpenAI from "openai";
import { db } from "./storage";
import { draftEbooks, books } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import {
  checkTitleOriginality,
  formatTitleCollisions,
  isClassicOrPublicDomainGenre,
} from "./titleOriginality";

export type TitleCollisionRepairResult = {
  draftId: number;
  oldTitle: string;
  newTitle: string;
  coverUrl: string | null;
  publishedBookId: number | null;
  collisionsFound: string;
  steps: string[];
};

function getOpenAI(): OpenAI {
  // Prefer direct OpenAI from Windows Cursor — Replit AI proxy often fails with fetch/connection errors off-Replit.
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  throw new Error("No OpenAI API key configured (OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_*)");
}

/** Build a premise brief from the actual book (outline + manuscript), not just the blurb. */
function scanBookForRename(opts: {
  topic?: string | null;
  description?: string | null;
  outline?: string | null;
  content?: string | null;
}): string {
  const outline = (opts.outline || "").replace(/\s+/g, " ").trim().slice(0, 2800);
  const content = (opts.content || "").replace(/\s+/g, " ").trim().slice(0, 3500);
  const topic = (opts.topic || "").replace(/\s+/g, " ").trim().slice(0, 400);
  const blurb = (opts.description || "").replace(/\s+/g, " ").trim().slice(0, 500);
  const parts: string[] = [];
  if (outline) parts.push(`OUTLINE (authoritative):\n${outline}`);
  if (content) parts.push(`MANUSCRIPT SAMPLE (authoritative):\n${content}`);
  if (topic) parts.push(`Topic field (may be stale):\n${topic}`);
  if (blurb) parts.push(`Storefront blurb (may be stale):\n${blurb}`);
  return parts.join("\n\n") || "(no book text available)";
}

async function proposeReplacementTitle(opts: {
  oldTitle: string;
  genre: string;
  topic: string;
  description: string;
  outline?: string | null;
  content?: string | null;
}): Promise<string> {
  const openai = getOpenAI();
  const bookScan = scanBookForRename(opts);
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: [
      {
        role: "system",
        content:
          "You rename ebook titles that collide with existing published books. " +
          "Return ONLY valid JSON: {\"titles\":[\"...\",\"...\",\"...\"]}. " +
          "Each title must be completely original — never used by another author online. " +
          "CRITICAL: Read the OUTLINE and MANUSCRIPT SAMPLE and name THIS book — same genre, characters, setting, and plot. " +
          "Do not invent unrelated settings, objects, or genres (e.g. never turn cosmic horror into a pantry story, or a thriller into a gardening how-to). " +
          "Do not reuse key phrases from the old title if they appear in competing books.",
      },
      {
        role: "user",
        content: `Old title (COLLIDES with an existing book — must replace): "${opts.oldTitle}"
Genre: ${opts.genre}

Scan of the book (use this — not guesses):
${bookScan}

Propose 5 distinct replacement titles that accurately name THIS manuscript but will not match any known published book title.`,
      },
    ],
    temperature: 0.85,
    max_completion_tokens: 600,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  const titles: string[] = Array.isArray(parsed.titles) ? parsed.titles : [];
  return titles.map((t) => String(t || "").trim()).filter((t) => t.length >= 5)[0] || "";
}

async function pickOriginalTitle(opts: {
  oldTitle: string;
  genre: string;
  topic: string;
  description: string;
  outline?: string | null;
  content?: string | null;
}): Promise<{ title: string; attempts: string[] }> {
  const attempts: string[] = [];
  for (let round = 0; round < 3; round++) {
    const candidate = await proposeReplacementTitle(opts);
    if (!candidate) continue;
    attempts.push(candidate);
    const check = await checkTitleOriginality(candidate, {
      genre: opts.genre,
      failClosedOnNetworkError: false,
    });
    if (check.ok) return { title: candidate, attempts };
    console.warn(
      `[TitleCollisionRepair] Candidate blocked: "${candidate}" — ${formatTitleCollisions(check)}`,
    );
  }
  // Last resort: append unique qualifier unlikely to exist as a published title
  const fallback = `${opts.oldTitle.replace(/\s+/g, " ").trim()} — EbookGamez Edition ${Date.now().toString(36)}`;
  attempts.push(fallback);
  return { title: fallback, attempts };
}

function rewriteTitleInText(text: string | null | undefined, oldTitle: string, newTitle: string): string | null {
  if (!text) return text ?? null;
  if (!oldTitle) return text;
  // Case-insensitive replace of exact old title occurrences
  const re = new RegExp(oldTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return text.replace(re, newTitle);
}

const MODEL_STYLE_IDS = new Set([
  "replit-cinematic",
  "dalle3-vivid",
  "cinematic-openai",
  "artistic-painterly",
  "artistic-compact",
  "vivid-atmospheric",
  "standalone-scenes",
  "reference-inspired",
  "vivid-painterly-pro",
  "atmospheric-cinema",
  "experimental-239",
  "classic-239",
  "classic-library-239",
  "test-style-a",
  "test-style-b",
  "test-style-c",
  "test-style-d",
  "test-style-e",
  "test-style-f",
  "test-style-g",
  "test-style-h",
]);

/**
 * Re-run the exact Cover Review / preset path that created this draft's cover.
 * Prefer stored coverStyleId → ModelStyleId generators; else CoverStylePreset; else default.
 */
async function regenerateCoverWithOriginalTools(
  draftId: number,
  styleId: string | null | undefined,
  steps: string[],
  contentStudio: typeof import("./contentStudio"),
): Promise<string> {
  if (styleId && MODEL_STYLE_IDS.has(styleId)) {
    // Same Cover Review generators + Title Embed Sync (title baked into the art)
    const result = await contentStudio.regenerateSelectedBackgrounds(
      [draftId],
      styleId as import("./contentStudio").ModelStyleId,
      true, // titleEmbedSync
    );
    if (result.generated < 1) {
      throw new Error(
        result.lastError || `Model-style cover regen failed for "${styleId}" on draft #${draftId}`,
      );
    }
    steps.push(`Cover regenerated with original model style "${styleId}" + Title Embed Sync`);

    const [after] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
    if (after?.coverUrl) {
      steps.push("Cover finalized by Title Embed Sync (title baked into artwork)");
      return after.coverUrl;
    }
    if (after?.backgroundUrl) {
      // Embed path fell back to non-embedded generation — apply overlay tools
      const coverUrl = await contentStudio.updateCoverTextOnly(draftId);
      steps.push("Title Embed Sync fell back; overlay applied via updateCoverTextOnly");
      return coverUrl;
    }
    throw new Error(`Draft #${draftId} has no cover or background after model-style regen`);
  }

  if (styleId && contentStudio.getCoverStyleById(styleId)) {
    const coverUrl = await contentStudio.regenerateCoverWithStyle(draftId, styleId);
    steps.push(`Cover regenerated with CoverStylePreset "${styleId}"`);
    return coverUrl;
  }

  if (styleId) {
    steps.push(`Unknown coverStyleId "${styleId}" — falling back to default generateCoverImage`);
  }
  const coverUrl = await contentStudio.regenerateCover(draftId);
  steps.push("Cover regenerated (default generateCoverImage path)");
  return coverUrl;
}

/**
 * Rename a colliding draft, regenerate cover with the same style path when possible,
 * republish to catalog. Does not stop the pipeline on illustration regen failure —
 * cover + title update is enough to clear the legal title collision; illustrations
 * are refreshed when markers mention the old title (caption text updated + regen queued).
 */
export async function resolveTitleCollisionAndRepublish(
  draftId: number,
  opts?: { skipPublish?: boolean; pushToLive?: boolean; forceRename?: boolean },
): Promise<TitleCollisionRepairResult> {
  const steps: string[] = [];
  const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!draft) throw new Error(`Draft #${draftId} not found`);

  if (isClassicOrPublicDomainGenre(draft.genre)) {
    throw new Error(`Draft #${draftId} is Classic/public-domain — do not auto-rename`);
  }

  const oldTitle = draft.title || "";
  steps.push(`Loaded draft #${draftId} "${oldTitle}"`);

  const external = await checkTitleOriginality(oldTitle, { genre: draft.genre });
  const collisionsFound = formatTitleCollisions(external);
  if (external.ok && !opts?.forceRename) {
    steps.push("No external collision detected — aborting (use forceRename to rename anyway).");
    throw new Error(
      `Draft #${draftId} "${oldTitle}" currently passes originality check (${collisionsFound}). Pass forceRename if you still want a new title.`,
    );
  }
  steps.push(
    external.ok
      ? `forceRename: proceeding despite clean check (${collisionsFound})`
      : `Collision confirmed: ${collisionsFound}`,
  );

  const { title: newTitle, attempts } = await pickOriginalTitle({
    oldTitle,
    genre: draft.genre || "Fiction",
    topic: draft.topic || "",
    description: draft.description || "",
    outline: draft.outline,
    content: draft.content,
  });
  steps.push(`Title candidates tried: ${attempts.join(" | ")}`);
  steps.push(`Chosen new title: "${newTitle}"`);

  const newTopic = rewriteTitleInText(draft.topic, oldTitle, newTitle) || draft.topic;
  let newDescription = rewriteTitleInText(draft.description, oldTitle, newTitle) || draft.description;
  // Keep old title for Push→Production matching (dev/prod IDs collide; exact title match fails after rename)
  const { recordPreviousTitleInDescription } = await import("@shared/titleRepairMetadata");
  newDescription = recordPreviousTitleInDescription(newDescription, oldTitle);
  let newContent = rewriteTitleInText(draft.content, oldTitle, newTitle) || draft.content;
  const newOutline = rewriteTitleInText(draft.outline, oldTitle, newTitle) || draft.outline;

  await db
    .update(draftEbooks)
    .set({
      title: newTitle,
      topic: newTopic,
      description: newDescription,
      content: newContent,
      outline: newOutline,
    })
    .where(eq(draftEbooks.id, draftId));
  steps.push("Draft fields updated with new title");

  // Regenerate cover with the SAME tools that created it (stored coverStyleId).
  // Most catalog covers use Cover Review ModelStyleId generators (cinematic-openai,
  // classic-library-239, etc.) via regenerateSelectedBackgrounds + Title Embed Sync.
  const contentStudio = await import("./contentStudio");
  let coverUrl: string | null = null;
  const styleId = draft.coverStyleId;
  try {
    coverUrl = await regenerateCoverWithOriginalTools(draftId, styleId, steps, contentStudio);
  } catch (e: any) {
    steps.push(`Cover regen failed: ${e?.message || e}`);
    throw e;
  }

  // If illustration markers mention the old title, rewrite captions (images may still
  // be regenerated separately via illustration pipeline when production allows).
  if (newContent && /\[ILLUSTRATION:/i.test(newContent) && oldTitle) {
    const before = newContent;
    newContent = rewriteTitleInText(newContent, oldTitle, newTitle) || newContent;
    if (newContent !== before) {
      await db.update(draftEbooks).set({ content: newContent }).where(eq(draftEbooks.id, draftId));
      steps.push("Updated old title inside illustration marker captions");
    }
  }

  let publishedBookId: number | null = null;
  if (!opts?.skipPublish && (draft.status === "published" || draft.status === "ready")) {
    // Reload cover URL after regen (Title Embed may have set it on the draft)
    const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
    const finalCover = coverUrl || fresh?.coverUrl || fresh?.backgroundUrl || null;

    if (draft.status === "published") {
      // Already in catalog — sync title/cover; do not call publishDraft (throws if published)
      const catalog =
        (await contentStudio.findCatalogBookForDraft(draftId, newTitle)) ||
        (await contentStudio.findCatalogBookForDraft(draftId, oldTitle));
      const catalogDesc = contentStudio.getCatalogDescriptionFromDraft(newDescription, newTitle);
      if (catalog) {
        await db
          .update(books)
          .set({
            title: newTitle,
            coverUrl: finalCover || undefined,
            description: catalogDesc || undefined,
            sourceDraftId: draftId,
          })
          .where(eq(books.id, catalog.id));
        publishedBookId = catalog.id;
        steps.push(`Synced published catalog book #${catalog.id} with new title/cover`);
      } else {
        steps.push("No linked catalog row found — updating any rows still on old title");
      }
      await db
        .update(books)
        .set({
          title: newTitle,
          coverUrl: finalCover || undefined,
          description: catalogDesc,
        })
        .where(sql`LOWER(TRIM(${books.title})) = LOWER(TRIM(${oldTitle}))`);
      steps.push("Updated any catalog rows that still had the old title");
    } else {
      publishedBookId = await contentStudio.publishDraft(draftId);
      steps.push(`Published as catalog book #${publishedBookId}`);
      await db
        .update(books)
        .set({
          title: newTitle,
          coverUrl: finalCover || undefined,
          description: contentStudio.getCatalogDescriptionFromDraft(newDescription, newTitle),
        })
        .where(sql`LOWER(TRIM(${books.title})) = LOWER(TRIM(${oldTitle}))`);
      steps.push("Updated any catalog rows that still had the old title");
    }
  }

  return {
    draftId,
    oldTitle,
    newTitle,
    coverUrl,
    publishedBookId,
    collisionsFound,
    steps,
  };
}

/** Check a candidate title before creating a placer; returns null if OK, else collision summary. */
export async function blockIfTitleNotOriginal(
  title: string,
  genre?: string | null,
): Promise<string | null> {
  const result = await checkTitleOriginality(title, {
    genre,
    failClosedOnNetworkError: true,
  });
  if (result.ok) return null;
  return formatTitleCollisions(result);
}
