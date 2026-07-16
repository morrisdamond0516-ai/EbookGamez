/**
 * Fill empty chapters on all Fix-later published books (1 image each),
 * generate art, clear deferral tags on structural pass.
 *
 * Stop after 2 consecutive transport failures.
 *
 * Usage: npx tsx --import ./script/load-env.ts script/fix-all-deferral-illustrations.ts
 * Optional: --limit=N  --start-id=N
 */
import "./load-env.ts";
import OpenAI from "openai";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq } from "drizzle-orm";
import {
  parseQualityDeferralFromDescription,
  stripQualityDeferralFromDescription,
} from "../shared/qualityDeferralMetadata";
import {
  countAsciiPuzzleLines,
  prepareActivityBookForIllustrationPipeline,
  isActivityOrWorkbookGenre,
} from "../shared/activityBookContent";
import {
  generateIllustrations,
  runPublishPipelineGate,
  getVisualEnhancedConfig,
} from "../server/contentStudio";

// Prefer direct OpenAI — AI Integrations base URL often fails TLS/socket on Windows.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY
    ? undefined
    : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const startArg = args.find((a) => a.startsWith("--start-id="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
const START_ID = startArg ? parseInt(startArg.split("=")[1], 10) : 0;

function emptyChapterNums(content: string): number[] {
  const chMatches = [...content.matchAll(/##\s*Chapter\s+(\d+)/gi)];
  const empty: number[] = [];
  for (let i = 0; i < chMatches.length; i++) {
    const start = chMatches[i].index!;
    const end = i + 1 < chMatches.length ? chMatches[i + 1].index! : content.length;
    const ch = content.slice(start, end);
    const resolved = (ch.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
    if (resolved === 0) empty.push(parseInt(chMatches[i][1], 10));
  }
  return empty;
}

function countUnresolvedMarkers(content: string): number {
  return [...content.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].filter((m) => {
    const p = m[1].trim();
    return !p.startsWith("/") && !p.startsWith("http");
  }).length;
}

function isTransport(err: unknown): boolean {
  const e = err as { name?: string; message?: string };
  const msg = String(e?.message || err || "").toLowerCase();
  return (
    e?.name === "TransportAbortError" ||
    msg.includes("connection") ||
    msg.includes("fetch failed") ||
    msg.includes("socket") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("und_err") ||
    msg.includes("network")
  );
}

async function injectOnePerEmptyChapter(
  content: string,
  genre: string,
  title: string,
  chapterNums: number[],
): Promise<{ content: string; injected: number }> {
  const visualConfig = getVisualEnhancedConfig(genre);
  if (!visualConfig) return { content, injected: 0 };

  let updated = content;
  let injected = 0;
  let skipPlacementLlm = false;

  for (const chNum of chapterNums) {
    const headers = [...updated.matchAll(/##\s*Chapter\s+(\d+)[^\n]*/gi)];
    const chIdx = headers.findIndex((h) => parseInt(h[1], 10) === chNum);
    if (chIdx < 0) continue;

    const chStart = headers[chIdx].index!;
    const chEnd = chIdx + 1 < headers.length ? headers[chIdx + 1].index! : updated.length;
    const chapterText = updated.slice(chStart, chEnd);

    // Already has a pending or resolved marker — leave for generateIllustrations
    if (/\[ILLUSTRATION:/i.test(chapterText)) continue;

    const chapterTitle = headers[chIdx][0].replace(/^##\s*/, "").trim();
    let description: string | null = null;
    let after: string | null = null;

    if (!skipPlacementLlm) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You place ONE illustration in a ${genre} book chapter. Output ONLY JSON:
{"after":"exact phrase copied from the chapter text","description":"detailed image prompt"}
Art style: ${visualConfig.illustrationStyle}. Description must be specific and visual. "after" must be copied exactly.`,
            },
            {
              role: "user",
              content: `Book: "${title}"\nChapter: "${chapterTitle}"\n\n${chapterText.substring(0, 6000)}`,
            },
          ],
          temperature: 0.6,
          response_format: { type: "json_object" },
        });
        const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
        after = parsed.after || parsed.anchor || null;
        description = parsed.description || null;
      } catch (err: any) {
        console.warn(`  Ch${chNum} placement LLM failed: ${err.message} — using heuristic for remaining chapters`);
        skipPlacementLlm = true;
      }
    }

    if (!description) {
      description = `${chapterTitle}: illustrative scene for a ${genre} book, ${visualConfig.illustrationStyle}, clear composition, professional published-book quality`;
    }

    let insertPos = -1;
    if (after && after.length >= 12) {
      let afterIdx = updated.indexOf(after, chStart);
      if (afterIdx === -1 || afterIdx >= chEnd) {
        const short = after.slice(0, Math.min(60, after.length)).trim();
        if (short.length >= 15) afterIdx = updated.indexOf(short, chStart);
      }
      if (afterIdx >= chStart && afterIdx < chEnd) {
        insertPos = afterIdx + Math.min(after.length, chEnd - afterIdx);
      }
    }

    if (insertPos < 0) {
      const paras = chapterText
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 60 && !p.startsWith("#") && !p.startsWith("[ILLUSTRATION"));
      const anchor = paras[Math.min(1, Math.max(0, paras.length - 1))];
      if (!anchor) {
        console.warn(`  Ch${chNum}: no insert anchor — skip`);
        continue;
      }
      const pos = updated.indexOf(anchor, chStart);
      if (pos < 0 || pos >= chEnd) continue;
      insertPos = pos + anchor.length;
    }

    const marker = `\n\n[ILLUSTRATION: ${description}]\n\n`;
    updated = updated.slice(0, insertPos) + marker + updated.slice(insertPos);
    injected++;
    // Refresh chapter slice bounds after mutation for next iteration via re-match
    await new Promise((r) => setTimeout(r, 250));
  }

  return { content: updated, injected };
}

const published = await db.select().from(draftEbooks).where(eq(draftEbooks.status, "published"));
let deferred = published
  .filter((d) => parseQualityDeferralFromDescription(d.description) && d.id >= START_ID)
  .sort((a, b) => a.id - b.id);

if (Number.isFinite(LIMIT)) deferred = deferred.slice(0, LIMIT);

console.log(`\n=== Fix-later illustrations: ${deferred.length} books (start-id=${START_ID}) ===\n`);

let ok = 0;
let failed = 0;
let skipped = 0;
let consecutiveTransport = 0;
const failedIds: string[] = [];

for (let i = 0; i < deferred.length; i++) {
  const draft = deferred[i];
  const title = draft.title || `Draft ${draft.id}`;
  console.log(`\n======== [${i + 1}/${deferred.length}] #${draft.id} ${title} ========`);

  try {
    let content = draft.content || "";
    if (!content.trim()) {
      skipped++;
      console.log("No content — skip");
      continue;
    }

    const genre = draft.genre || "General";
    if (!getVisualEnhancedConfig(genre)) {
      skipped++;
      console.log("Not visual-enhanced genre — skip");
      continue;
    }

    if (isActivityOrWorkbookGenre(genre) && countAsciiPuzzleLines(content) > 0) {
      const prepared = prepareActivityBookForIllustrationPipeline(content, genre);
      if (prepared.asciiBlocksConverted > 0 || prepared.content !== content) {
        content = prepared.content;
        console.log(`ASCII converted: ${prepared.asciiBlocksConverted} block(s)`);
        await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));
      }
    }

    const empty = emptyChapterNums(content);
    console.log(`Empty chapters: ${empty.length}${empty.length ? ` [${empty.join(",")}]` : ""}`);

    if (empty.length > 0) {
      const { content: withMarkers, injected } = await injectOnePerEmptyChapter(
        content,
        genre,
        title,
        empty,
      );
      content = withMarkers;
      console.log(`Injected ${injected} marker(s)`);
      if (injected > 0) {
        await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));
      }
    }

    const unresolved = countUnresolvedMarkers(content);
    console.log(`Pending markers to generate: ${unresolved}`);

    if (unresolved > 0) {
      content = await generateIllustrations(content, genre, title, draft.id);
      await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));
    }

    const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draft.id));
    const gate = await runPublishPipelineGate(fresh!, {
      verifyGenre: false,
      dialogueCheck: false,
    });

    if (gate.pass) {
      await db
        .update(draftEbooks)
        .set({ description: stripQualityDeferralFromDescription(fresh!.description) })
        .where(eq(draftEbooks.id, draft.id));
      ok++;
      consecutiveTransport = 0;
      console.log("PASS — deferral cleared");
    } else {
      failed++;
      consecutiveTransport = 0;
      const reason = gate.issues.slice(0, 2).join("; ");
      failedIds.push(`#${draft.id}: ${reason}`);
      console.log(`FAIL gate: ${reason}`);
    }
  } catch (err: any) {
    console.error(`ERROR #${draft.id}:`, err?.message || err);
    failed++;
    failedIds.push(`#${draft.id}: ${err?.message || err}`);
    if (isTransport(err)) {
      consecutiveTransport++;
      if (consecutiveTransport >= 2) {
        console.error("\nStopped after 2 consecutive transport failures — diagnose before more API spend.");
        break;
      }
    } else {
      consecutiveTransport = 0;
    }
  }
}

console.log(`\n=== DONE ===`);
console.log({ ok, failed, skipped, processed: ok + failed + skipped });
if (failedIds.length) {
  console.log("Failures:");
  for (const f of failedIds.slice(0, 40)) console.log(" ", f);
  if (failedIds.length > 40) console.log(`  ... +${failedIds.length - 40}`);
}

process.exit(consecutiveTransport >= 2 ? 2 : 0);
