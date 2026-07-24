/**
 * Filtered title-collision count: exclude generic curriculum / subject titles
 * that naturally exist everywhere (Biology, Grade 7 Math, etc.).
 *
 *   node script/run-tsx.mjs script/count-filtered-title-collisions.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { and, ne, sql } from "drizzle-orm";
import {
  checkTitleOriginality,
  isClassicOrPublicDomainGenre,
} from "../server/titleOriginality";

/** Titles that are course/subject labels, not branded book names. */
function isGenericCurriculumTitle(title: string): boolean {
  const t = title.trim();
  if (/^(Kindergarten|Grade\s*\d+|High School|College|Introductory|Introduction to)\b/i.test(t)) {
    return true;
  }
  if (/\b(Fundamentals|Foundations|Principles|Survey|I|II|III)\s*$/i.test(t) && t.length < 45) {
    // e.g. "HVAC Fundamentals", "Spanish I", "Calculus I"
    if (
      /^(Algebra|Geometry|Biology|Chemistry|Physics|Economics|Psychology|Sociology|Precalculus|Calculus|Statistics|Anatomy|Physiology|Macroeconomics|Microeconomics|Accounting|Bookkeeping|Plumbing|Welding|Automotive|Cosmetology|Culinary|Cybersecurity|Project Management|Medical Assisting|Construction|Public Speaking|Critical Thinking|College Algebra|College Physics|College Success|Financial Accounting|Human Anatomy|American History|United States History|World History|Earth|Environmental|Personal Finance|Computer Science|English \d+)/i.test(
        t,
      )
    ) {
      return true;
    }
  }

  const exactGeneric = new Set(
    [
      "Biology",
      "Chemistry",
      "Physics",
      "Geometry",
      "Algebra I",
      "Algebra II",
      "Precalculus",
      "Calculus I",
      "Macroeconomics",
      "Microeconomics",
      "World History",
      "United States History",
      "Spanish I",
      "Spanish II",
      "Economics for High School",
      "High School Health",
      "High School Statistics",
      "US Government & Civics",
      "Personal Finance for Teens",
      "Computer Science Principles",
      "Public Speaking & Debate",
      "Introduction to Psychology",
      "Introduction to Sociology",
      "Introduction to Business",
      "Introduction to Programming",
      "Introductory Statistics",
      "General Biology I",
      "General Chemistry I",
      "College Algebra",
      "College Physics I",
      "College Success & Study Skills",
      "Psychology for High School",
      "Financial Accounting Fundamentals",
      "Public Speaking for College",
      "Critical Thinking & Logic",
      "Human Anatomy & Physiology I",
      "American History Survey",
      "HVAC Fundamentals",
      "Automotive Fundamentals",
      "Welding Basics",
      "Plumbing Fundamentals",
      "Construction Safety Essentials",
      "Cosmetology Fundamentals",
      "Culinary Arts Foundations",
      "Cybersecurity Fundamentals",
      "Project Management Foundations",
      "Bookkeeping for Small Business",
      "Medical Assisting Fundamentals",
      "Earth & Environmental Science",
    ].map((x) => x.toLowerCase()),
  );
  if (exactGeneric.has(t.toLowerCase())) return true;

  // Grade/K health/phonics/reading schoolbook placers
  if (/^(Kindergarten|Grade\s*\d+)\b/i.test(t)) return true;

  return false;
}

async function main() {
  const drafts = await db
    .select({
      id: draftEbooks.id,
      title: draftEbooks.title,
      genre: draftEbooks.genre,
      status: draftEbooks.status,
    })
    .from(draftEbooks)
    .where(and(ne(draftEbooks.status, "idea"), sql`${draftEbooks.title} IS NOT NULL`));

  const hits: { id: number; title: string; genre: string | null; kind: string }[] = [];
  let skippedClassic = 0;
  let skippedGeneric = 0;
  let checked = 0;

  for (const d of drafts) {
    if (!d.title) continue;
    if (isClassicOrPublicDomainGenre(d.genre)) {
      skippedClassic++;
      continue;
    }
    if (isGenericCurriculumTitle(d.title)) {
      skippedGeneric++;
      continue;
    }

    checked++;
    const result = await checkTitleOriginality(d.title, { genre: d.genre });
    if (!result.ok) {
      const kind = result.collisions.some((c) => c.matchKind === "exact") ? "exact" : "near";
      hits.push({ id: d.id, title: d.title, genre: d.genre, kind });
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(
    JSON.stringify(
      {
        totalDrafts: drafts.length,
        skippedClassic,
        skippedGenericCurriculum: skippedGeneric,
        checkedNonGeneric: checked,
        filteredCollisionCount: hits.length,
      },
      null,
      2,
    ),
  );
  console.log("\n=== FILTERED COLLISIONS ===");
  for (const h of hits.sort((a, b) => a.title.localeCompare(b.title))) {
    console.log(`#${h.id} [${h.kind}] ${h.genre || "?"} | ${h.title}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
