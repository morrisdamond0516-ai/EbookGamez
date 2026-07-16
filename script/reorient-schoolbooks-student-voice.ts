/**
 * Reorient Schoolbooks Catalog to STUDENT take-home textbooks.
 *
 * 1) Rewrite writing briefs on every schoolbook draft (K–trade).
 * 2) Clear outline+content on books already written in teacher/parent voice
 *    so generateContentForDraft cannot "resume" the wrong manuscript.
 * 3) Demote published catalog rows; set drafts to draft.
 * 4) Queue full content regeneration for books that had content (and have covers).
 *
 * Usage:
 *   npx tsx --import ./script/load-env.ts script/reorient-schoolbooks-student-voice.ts
 *   npx tsx --import ./script/load-env.ts script/reorient-schoolbooks-student-voice.ts --dry-run
 *   npx tsx --import ./script/load-env.ts script/reorient-schoolbooks-student-voice.ts --briefs-only
 *   npx tsx --import ./script/load-env.ts script/reorient-schoolbooks-student-voice.ts --start-rewrite
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "../shared/schema";
import { eq, or, ilike, and, sql } from "drizzle-orm";
import {
  formatDescriptionWithWritingBrief,
  parseWritingBriefFromDescription,
  type ResearchWritingBrief,
  generateContentForDraft,
} from "../server/contentStudio";
import { draftHasPublishableCover } from "../server/coverStorage";
import { isSchoolbooksCatalogDraft } from "../shared/educationalBookQuality";

const dryRun = process.argv.includes("--dry-run");
const briefsOnly = process.argv.includes("--briefs-only");
const startRewrite = process.argv.includes("--start-rewrite");

function studentBriefForDraft(d: {
  title: string | null;
  genre: string | null;
  topic: string | null;
  description: string | null;
}): ResearchWritingBrief {
  const title = d.title || "Untitled";
  const existing = parseWritingBriefFromDescription(d.description);
  const gradeBand =
    existing?.gradeBand ||
    (title.match(/Kindergarten|Grade\s+\d+|High School|College|Trade/i)?.[0] ?? "School");
  const subject =
    existing?.subjectArea ||
    title
      .replace(/^(Kindergarten|Grade\s+\d+)\s+/i, "")
      .replace(/:\s*Complete School Year$/i, "")
      .trim() ||
    "General";

  const agesHint =
    /Kindergarten/i.test(title)
      ? "ages 5–6"
      : /Grade\s+1\b/i.test(title)
        ? "ages 6–7"
        : /Grade\s+2\b/i.test(title)
          ? "ages 7–8"
          : /Grade\s+3\b/i.test(title)
            ? "ages 8–9"
            : /Grade\s+4\b/i.test(title)
              ? "ages 9–10"
              : /Grade\s+5\b/i.test(title)
                ? "ages 10–11"
                : "";

  return {
    targetAudience: `${gradeBand} students${agesHint ? ` (${agesHint})` : ""} — the learner who reads and practices from this take-home textbook (teachers assign it; parents may help, but the book speaks to the student)`,
    marketRationale:
      existing?.marketRationale ||
      `US school demand for ${subject} at ${gradeBand}; compete with Big-3 textbook clarity in a book students take home`,
    toneAndVoice: `STUDENT TEXTBOOK voice — written TO the ${gradeBand} learner, not to parents or teachers. Second person ("you") addressing the student. Grade-appropriate vocabulary and sentence length. Encouraging, clear, never condescending. This is the book a classroom teacher hands out for students to read, practice, and take home — NOT a teacher manual, NOT a parent guide.`,
    dialogueGuidance:
      "Short student-friendly Q&A and think-alouds in learner language. Never address 'your child', 'parents', or 'teachers' as the reader. Optional brief helper tip only in a labeled sidebar — default body is 100% student-facing.",
    characterVoices: [
      "Narrator/coach: speaks directly to the student as 'you'",
      "Student examples: diverse classmates solving problems at this grade level",
    ],
    narrativeBeats: existing?.narrativeBeats?.length
      ? existing.narrativeBeats
      : [
          "Unit openers with clear learning goals for the student",
          "Worked examples then guided practice then independent practice",
          "End-of-unit review and confidence-building self-check",
        ],
    themes: existing?.themes?.length ? existing.themes : ["foundations", "practice", "growth mindset"],
    gradeBand,
    subjectArea: subject,
    standardsFocus: existing?.standardsFocus,
    learningObjectives: existing?.learningObjectives,
    instructionalPattern: "objective → explain → worked example → practice → check for understanding",
  };
}

function catalogBlurb(description: string | null | undefined, title: string): string {
  const raw = (description || "").replace(/---WRITING_BRIEF_START---[\s\S]*?---WRITING_BRIEF_END---\s*/i, "").trim();
  if (raw) return raw;
  return `A complete student take-home textbook: ${title}. Lessons, examples, practice, and checks for understanding — written for the student.`;
}

const rows = await db
  .select()
  .from(draftEbooks)
  .where(
    or(
      ilike(draftEbooks.description, "%Schoolbooks Catalog%"),
      ilike(draftEbooks.title, "Kindergarten %"),
      ilike(draftEbooks.title, "Grade %"),
      and(ilike(draftEbooks.title, "%Complete School Year%"), eq(draftEbooks.genre, "Textbooks")),
    ),
  );

// Deduplicate + keep schoolbooks catalog / elementary-college educational titles
const schoolbooks = rows.filter((d) => {
  if (isSchoolbooksCatalogDraft(d.description)) return true;
  const t = d.title || "";
  return (
    /^(Kindergarten|Grade\s+\d+)\b/i.test(t) ||
    /Complete School Year/i.test(t) ||
    /^(English|Algebra|Geometry|Biology|Chemistry|Physics|College|HVAC|CNA|CDL)/i.test(t)
  );
});

console.log(`\n=== Reorient ${schoolbooks.length} schoolbook drafts to student take-home voice ===`);
console.log({ dryRun, briefsOnly, startRewrite });

const rewriteIds: number[] = [];
let briefsUpdated = 0;
let contentCleared = 0;
let demoted = 0;

for (const d of schoolbooks.sort((a, b) => a.id - b.id)) {
  const brief = studentBriefForDraft(d);
  const tag = isSchoolbooksCatalogDraft(d.description)
    ? ""
    : ""; // keep existing catalog tag inside blurb
  let blurb = catalogBlurb(d.description, d.title || "");
  if (!/\[Schoolbooks Catalog/i.test(blurb) && isSchoolbooksCatalogDraft(d.description)) {
    const m = (d.description || "").match(/\[Schoolbooks Catalog[^\]]*\]/);
    if (m) blurb = `${m[0]} ${blurb}`;
  } else if (!/\[Schoolbooks Catalog/i.test(blurb) && /^(Kindergarten|Grade\s+\d+)\b/i.test(d.title || "")) {
    blurb = `[Schoolbooks Catalog] ${blurb}`;
  }
  const newDescription = formatDescriptionWithWritingBrief(brief, blurb);

  const words = (d.content || "").split(/\s+/).filter(Boolean).length;
  const needsRewrite = words >= 800;

  console.log(
    `#${d.id} ${(d.title || "").slice(0, 50)} status=${d.status} words=${words} rewrite=${needsRewrite}`,
  );

  if (!dryRun) {
    await db
      .update(draftEbooks)
      .set({ description: newDescription })
      .where(eq(draftEbooks.id, d.id));
    briefsUpdated++;

    if (!briefsOnly && needsRewrite) {
      // Force full regen — do not resume teacher-voice chapters
      await db
        .update(draftEbooks)
        .set({
          content: null,
          outline: null,
          status: "draft",
          pdfUrl: null,
        })
        .where(eq(draftEbooks.id, d.id));
      contentCleared++;

      if (d.status === "published" || d.publishedAt) {
        await db
          .update(draftEbooks)
          .set({ publishedAt: null, status: "draft" })
          .where(eq(draftEbooks.id, d.id));
        await db
          .update(books)
          .set({ visible: false })
          .where(eq(books.sourceDraftId, d.id));
        demoted++;
      }

      const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, d.id));
      if (fresh && draftHasPublishableCover(fresh)) {
        rewriteIds.push(d.id);
      } else {
        console.log(`  skip queue — no publishable cover yet`);
      }
    }
  } else if (needsRewrite) {
    rewriteIds.push(d.id);
  }
}

console.log("\n=== SUMMARY ===");
console.log({ briefsUpdated, contentCleared, demoted, queuedForRewrite: rewriteIds.length, ids: rewriteIds });

if (!dryRun && startRewrite && rewriteIds.length > 0) {
  console.log(`\nStarting sequential content regeneration for ${rewriteIds.length} books...`);
  for (const id of rewriteIds) {
    try {
      console.log(`\n----- generateContentForDraft(${id}) -----`);
      await generateContentForDraft(id);
      console.log(`----- done ${id} -----`);
    } catch (err: any) {
      console.error(`FAILED #${id}:`, err?.message || err);
    }
  }
} else if (rewriteIds.length > 0 && !startRewrite) {
  console.log(
    `\nBriefs updated. To regenerate manuscripts:\n  npx tsx --import ./script/load-env.ts script/reorient-schoolbooks-student-voice.ts --start-rewrite\nOr generate Selected in Content Studio.`,
  );
}

process.exit(0);
