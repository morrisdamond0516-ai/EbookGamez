/**
 * Filtered collisions WITH external match titles for cross-reference.
 *   node script/run-tsx.mjs script/list-filtered-title-collisions-with-matches.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { and, ne, sql, inArray } from "drizzle-orm";
import {
  checkTitleOriginality,
  isClassicOrPublicDomainGenre,
} from "../server/titleOriginality";

function isGenericCurriculumTitle(title: string): boolean {
  const t = title.trim();
  if (/^(Kindergarten|Grade\s*\d+|High School|College|Introductory|Introduction to)\b/i.test(t)) {
    return true;
  }
  if (/\b(Fundamentals|Foundations|Principles|Survey|I|II|III)\s*$/i.test(t) && t.length < 45) {
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
      "Biology", "Chemistry", "Physics", "Geometry", "Algebra I", "Algebra II", "Precalculus",
      "Calculus I", "Macroeconomics", "Microeconomics", "World History", "United States History",
      "Spanish I", "Spanish II", "Economics for High School", "High School Health", "High School Statistics",
      "US Government & Civics", "Personal Finance for Teens", "Computer Science Principles",
      "Public Speaking & Debate", "Introduction to Psychology", "Introduction to Sociology",
      "Introduction to Business", "Introduction to Programming", "Introductory Statistics",
      "General Biology I", "General Chemistry I", "College Algebra", "College Physics I",
      "College Success & Study Skills", "Psychology for High School", "Financial Accounting Fundamentals",
      "Public Speaking for College", "Critical Thinking & Logic", "Human Anatomy & Physiology I",
      "American History Survey", "HVAC Fundamentals", "Automotive Fundamentals", "Welding Basics",
      "Plumbing Fundamentals", "Construction Safety Essentials", "Cosmetology Fundamentals",
      "Culinary Arts Foundations", "Cybersecurity Fundamentals", "Project Management Foundations",
      "Bookkeeping for Small Business", "Medical Assisting Fundamentals", "Earth & Environmental Science",
    ].map((x) => x.toLowerCase()),
  );
  if (exactGeneric.has(t.toLowerCase())) return true;
  if (/^(Kindergarten|Grade\s*\d+)\b/i.test(t)) return true;
  return false;
}

const FORCE_EXTRA = [
  {
    id: 724,
    title: "Luna and the Starwhale",
    note: "Near-match online bedtime story / star-whale kids cluster (e.g. Luna and the Star Whales on kidsstorie.com; Starwhal / The Star Whale published titles)",
  },
];

async function main() {
  const drafts = await db
    .select({
      id: draftEbooks.id,
      title: draftEbooks.title,
      genre: draftEbooks.genre,
    })
    .from(draftEbooks)
    .where(and(ne(draftEbooks.status, "idea"), sql`${draftEbooks.title} IS NOT NULL`));

  const rows: {
    id: number;
    ours: string;
    genre: string;
    kind: string;
    theirs: string;
    authors: string;
    source: string;
    year: string;
  }[] = [];

  for (const d of drafts) {
    if (!d.title) continue;
    if (isClassicOrPublicDomainGenre(d.genre)) continue;
    if (isGenericCurriculumTitle(d.title)) continue;

    const result = await checkTitleOriginality(d.title, { genre: d.genre });
    if (!result.ok && result.collisions.length) {
      // Prefer exact, then first near
      const best =
        result.collisions.find((c) => c.matchKind === "exact") || result.collisions[0];
      rows.push({
        id: d.id,
        ours: d.title,
        genre: d.genre || "?",
        kind: best.matchKind,
        theirs: best.title,
        authors: best.authors.slice(0, 2).join(", ") || "?",
        source: best.source,
        year: best.year != null ? String(best.year) : "?",
      });
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  rows.sort((a, b) => a.ours.localeCompare(b.ours));

  console.log("Draft#\tKind\tOur title\tMatching title online\tAuthor(s)\tYear\tSource\tGenre");
  for (const r of rows) {
    console.log(
      `#${r.id}\t${r.kind}\t${r.ours}\t${r.theirs}\t${r.authors}\t${r.year}\t${r.source}\t${r.genre}`,
    );
  }

  console.log("\n=== FORCE (manual / near cluster) ===");
  for (const f of FORCE_EXTRA) {
    console.log(`#${f.id}\tforce\t${f.title}\t${f.note}`);
  }

  console.log(`\nTotal filtered with external match: ${rows.length} (+ ${FORCE_EXTRA.length} force)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
