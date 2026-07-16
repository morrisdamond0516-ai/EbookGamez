/**
 * Educational / instructional materials quality — how US schools & libraries
 * evaluate textbooks, and how EbookGamez treats Textbooks / Education books.
 *
 * Research basis (not a claim of state adoption):
 * - State adoption (CA SBE, TX IMRA/TEKS): standards alignment, factual accuracy,
 *   grade suitability, full course organization, accessibility/manufacturing.
 * - Local-adoption states: district criteria often mirror the same pillars.
 * - School libraries (ALA selection toolkit): curriculum support, age/ability fit,
 *   accuracy, quality of presentation, format suitability.
 *
 * We cannot submit to a state board from this app. We *can* gate our ebooks so
 * they meet the same *content* pillars reviewers look for before a district
 * would consider a title for classroom or library use.
 *
 * ─── Page layout research (digital vs print) ───────────────────────────────
 * Print adoption still references manufacturing specs for *physical* books.
 * Digital HQIM (TX IMRA reports, CAST/AEM EPUB guidance, ADA Title II → WCAG 2.1 AA)
 * favors reflowable EPUB / web readers with:
 *   - clear heading structure
 *   - labeled instructional sections (objectives, examples, practice)
 *   - diagrams with captions / alt text
 *   - readable contrast — NOT fixed two-column print replicas
 * Conclusion: a McGraw-Hill-style fixed page grid is NOT necessary for digital
 * school/library use. A schoolbook *reader chrome* mode (section callouts +
 * inline diagrams) IS necessary so lessons are scannable like real digital texts.
 */

export const EDUCATIONAL_GENRES = [
  "Textbooks",
  "Education / Learning",
  "Technical Manuals",
  "Reference Books",
  "Case Studies",
] as const;

/** Genres that are primarily instructional (school / college / trade). */
export function isEducationalGenre(genre: string | null | undefined): boolean {
  const g = (genre || "").trim();
  if (!g) return false;
  if ((EDUCATIONAL_GENRES as readonly string[]).includes(g)) return true;
  const lower = g.toLowerCase();
  return (
    lower.includes("textbook") ||
    lower.includes("education / learning") ||
    lower === "education" ||
    lower.includes("technical manual") ||
    (lower.includes("reference") && lower.includes("book"))
  );
}

/** Reader should use schoolbook page chrome (not novel full-bleed art layout). */
export function usesSchoolbookPageLayout(genre: string | null | undefined): boolean {
  return isEducationalGenre(genre);
}

/** Schoolbooks catalog placers use this prefix in description. */
export function isSchoolbooksCatalogDraft(description: string | null | undefined): boolean {
  return /\[Schoolbooks Catalog/i.test(description || "");
}

export function isEducationalDraft(opts: {
  genre?: string | null;
  description?: string | null;
}): boolean {
  return isEducationalGenre(opts.genre) || isSchoolbooksCatalogDraft(opts.description);
}

/**
 * Pillars used by state boards / districts / school libraries when judging
 * instructional materials. Mapped to our automated checks.
 */
export const INSTRUCTIONAL_ADOPTION_PILLARS = [
  {
    id: "STANDARDS",
    name: "Standards & curriculum alignment",
    boardSource: "CA frameworks / TX TEKS coverage / Common Core & NGSS sequences",
    ourCheck: "Outline and chapters cover stated grade/subject objectives in sequence",
  },
  {
    id: "ACCURACY",
    name: "Factual accuracy & authority",
    boardSource: "IMRA factual-error review; ALA accuracy criterion",
    ourCheck: "Claims are careful, age-appropriate, and not fabricated as fiction",
  },
  {
    id: "GRADE_FIT",
    name: "Grade / age appropriateness",
    boardSource: "Suitability rubrics; ALA age/ability/emotional development",
    ourCheck: "Vocabulary, examples, and topics match the stated grade or career level",
  },
  {
    id: "PEDAGOGY",
    name: "Instructional design",
    boardSource: "Full course of study (CA EC 60010); HQIM clarity expectations",
    ourCheck: "Objective → explain → worked example → practice → check for understanding",
  },
  {
    id: "CLARITY",
    name: "Clarity & organization",
    boardSource: "District HQIM reviews; library presentation quality",
    ourCheck: "Logical unit/chapter sequence; clear headings; readable explanations",
  },
  {
    id: "PRACTICE",
    name: "Practice & formative checks",
    boardSource: "Adopted programs include exercises / end-of-chapter activities",
    ourCheck: "Practice items, try-its, or checks appear regularly — not lecture-only",
  },
  {
    id: "SUITABILITY",
    name: "Suitability for school/library",
    boardSource: "SBOE suitability; ALA curriculum support",
    ourCheck: "No inappropriate content for the stated audience; supports learning goals",
  },
  {
    id: "VISUALS",
    name: "Diagrams & visual aids",
    boardSource: "Textbook programs include figures; library format quality",
    ourCheck: "Illustration markers for diagrams/figures where concepts need visuals",
  },
] as const;

export type InstructionalSectionKind =
  | "objectives"
  | "example"
  | "practice"
  | "check"
  | "keyterms"
  | "review"
  | "other";

const INSTRUCTIONAL_SECTION_PATTERNS: { kind: InstructionalSectionKind; re: RegExp }[] = [
  { kind: "objectives", re: /^(learning\s+)?objectives?\b|^what\s+you(?:'|’)ll\s+learn\b|^goals?\b/i },
  { kind: "example", re: /^worked\s+examples?\b|^examples?\b|^i\s+do\b|^model(ed)?\s+problem\b|^sample\s+(problem|solution)\b/i },
  { kind: "practice", re: /^practice\b|^try\s+it\b|^your\s+turn\b|^we\s+do\b|^you\s+do\b|^exercises?\b/i },
  { kind: "check", re: /^check\s+(your\s+)?understanding\b|^exit\s+ticket\b|^self[- ]?check\b|^quick\s+check\b/i },
  { kind: "keyterms", re: /^key\s+terms?\b|^vocabulary\b|^words?\s+to\s+know\b|^glossary\b/i },
  { kind: "review", re: /^review\b|^chapter\s+summary\b|^remember\b|^answer\s+key\b/i },
];

/** Strip markdown heading/bold wrappers for section matching. */
export function plainInstructionalHeading(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/\*+/g, "")
    .trim();
}

export function getInstructionalSectionKind(line: string): InstructionalSectionKind | null {
  const trimmed = line.trim();
  const isMarkdownHeading = /^#{1,6}\s+\S/.test(trimmed);
  const isBoldOnlyTitle = /^\*\*[^*]+\*\*\s*:?\s*$/.test(trimmed);
  const plain = plainInstructionalHeading(trimmed);
  if (!plain || plain.length > 80) return null;

  // Bare titles ("Practice") OK; full prose sentences that start with Remember/Example are not headers.
  const looksLikeSentence =
    /[.!?].+\s/.test(plain) ||
    (plain.split(/\s+/).length >= 8 && !isMarkdownHeading && !isBoldOnlyTitle);
  if (!isMarkdownHeading && !isBoldOnlyTitle && looksLikeSentence) return null;

  for (const p of INSTRUCTIONAL_SECTION_PATTERNS) {
    if (p.re.test(plain)) return p.kind;
  }
  return null;
}

export function isInstructionalSectionHeader(line: string): boolean {
  return getInstructionalSectionKind(line) !== null;
}

function headingLevel(line: string): number {
  const m = line.trim().match(/^(#{1,6})\s+/);
  return m ? m[1].length : 3;
}

function isInstructionalChromeLine(line: string): boolean {
  const t = line.trim();
  return /^#{1,6}\s+\S/.test(t) || /^\*\*[^*]+\*\*\s*:?\s*$/.test(t);
}

/** Bare chrome like "## Practice" / "## Worked Example" — safe to strip when a more specific sibling follows. */
function isGenericShellHeading(line: string): boolean {
  const plain = plainInstructionalHeading(line)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (
    /^(learning\s+)?objectives?$/.test(plain) ||
    /^(worked\s+)?examples?$/.test(plain) ||
    /^practice$/.test(plain) ||
    /^check (your )?understanding$/.test(plain) ||
    /^(i do|we do|you do|try it|your turn)$/.test(plain) ||
    /^exercises?$/.test(plain) ||
    /^review$/.test(plain) ||
    /^key terms?$/.test(plain) ||
    /^vocabulary$/.test(plain) ||
    /^i do\s*(we do\s*)?(you do)?$/.test(plain)
  );
}

/** True when `next` is a nested/more-specific header under empty `current` chrome (safe to remove current). */
function isNestedEmptyShell(current: string, next: string): boolean {
  if (headingLevel(current) < headingLevel(next)) return true;
  if (isGenericShellHeading(current) && !isGenericShellHeading(next)) return true;
  const p1 = plainInstructionalHeading(current)
    .toLowerCase()
    .replace(/[^a-z0-9\s:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const p2 = plainInstructionalHeading(next)
    .toLowerCase()
    .replace(/[^a-z0-9\s:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (p1 === p2) return true;
  const p1Base = p1.split(":")[0].trim();
  if (p1Base.length >= 4 && p2.startsWith(p1Base) && p2.length > p1Base.length + 1) return true;
  return false;
}

/**
 * Empty shell / stacked chrome: "## Practice" immediately followed by
 * "### Practice A..." with no body between — reader shows two Practice banners,
 * only the second has content.
 */
export type EmptyInstructionalSectionDetail = {
  lineIndex: number;
  heading: string;
  kind: InstructionalSectionKind;
  reason: "empty-body" | "duplicate-shell";
  nextHeading?: string;
};

export function scanEmptyInstructionalSections(content: string): {
  details: EmptyInstructionalSectionDetail[];
  issues: string[];
} {
  const lines = content.split("\n");
  const details: EmptyInstructionalSectionDetail[] = [];

  const nextNonEmpty = (from: number): number => {
    for (let j = from + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t && t !== "---") return j;
    }
    return -1;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kind = getInstructionalSectionKind(line);
    if (!kind || !isInstructionalChromeLine(line)) continue;

    const next = nextNonEmpty(i);
    if (next < 0) {
      details.push({
        lineIndex: i,
        heading: line.trim(),
        kind,
        reason: "empty-body",
      });
      continue;
    }

    const nextLine = lines[next].trim();
    if (/^##\s*\**\s*Chapter\s+\d+/i.test(nextLine)) {
      details.push({
        lineIndex: i,
        heading: line.trim(),
        kind,
        reason: "empty-body",
      });
      continue;
    }

    const nextKind = getInstructionalSectionKind(nextLine);
    const nextIsChrome = isInstructionalChromeLine(nextLine);

    if (nextIsChrome && nextKind === kind) {
      // Nested "## Practice" → "### Practice A" = duplicate chrome (auto-repairable).
      // Peer "## Worked Example 5" → "## Worked Example 7" = empty body under 5 (flag only).
      const reason = isNestedEmptyShell(line, nextLine) ? "duplicate-shell" : "empty-body";
      details.push({
        lineIndex: i,
        heading: line.trim(),
        kind,
        reason,
        nextHeading: nextLine,
      });
      continue;
    }

    // Empty body until next primary markdown instructional heading (different kind).
    // Bold-only labels like **I do (model):** are in-section chrome, not a new section.
    const nextIsMarkdownHeading = /^#{1,6}\s+\S/.test(nextLine);
    if (
      nextIsMarkdownHeading &&
      nextKind &&
      nextKind !== kind &&
      headingLevel(nextLine) <= headingLevel(line)
    ) {
      details.push({
        lineIndex: i,
        heading: line.trim(),
        kind,
        reason: "empty-body",
        nextHeading: nextLine,
      });
    }
  }

  const issues: string[] = [];
  const shells = details.filter((d) => d.reason === "duplicate-shell");
  const empties = details.filter((d) => d.reason === "empty-body");
  if (shells.length > 0) {
    const samples = shells
      .slice(0, 4)
      .map((d) => `"${d.heading}" → "${d.nextHeading}"`)
      .join("; ");
    issues.push(
      `${shells.length} duplicate empty instructional section header(s) (e.g. Practice/Example chrome with no body before the next same section) — ${samples}`,
    );
  }
  if (empties.length > 0) {
    const samples = empties
      .slice(0, 4)
      .map((d) => `"${d.heading}"`)
      .join("; ");
    issues.push(
      `${empties.length} empty instructional section(s) with no example/practice content under the heading — ${samples}`,
    );
  }

  return { details, issues };
}

/**
 * Remove empty duplicate instructional chrome shells (keep the specific nested header).
 * Does not invent missing Example/Practice bodies — those stay flagged by the scan.
 * Does not remove peer numbered empties (Worked Example 5 before 7) — only nested/generic shells.
 */
export function repairEmptyInstructionalSections(content: string): {
  content: string;
  removed: number;
  details: string[];
} {
  const lines = content.split("\n");
  const remove = new Set<number>();
  const details: string[] = [];
  const scan = scanEmptyInstructionalSections(content);

  for (const d of scan.details) {
    if (d.reason !== "duplicate-shell") continue;
    remove.add(d.lineIndex);
    details.push(`removed shell: ${d.heading}`);
  }

  if (remove.size === 0) {
    return { content, removed: 0, details: [] };
  }

  const out = lines.filter((_, idx) => !remove.has(idx));
  const cleaned: string[] = [];
  let blankRun = 0;
  for (const line of out) {
    if (!line.trim()) {
      blankRun++;
      if (blankRun <= 1) cleaned.push(line);
    } else {
      blankRun = 0;
      cleaned.push(line);
    }
  }

  return {
    content: cleaned.join("\n"),
    removed: remove.size,
    details,
  };
}

/** Heading / phrase patterns that signal real instructional design (cheap scan). */
const PEDAGOGY_SIGNAL_PATTERNS: RegExp[] = [
  /\blearning\s+objectives?\b/i,
  /\bobjectives?\b/i,
  /\bwhat\s+you(?:'|’)ll\s+learn\b/i,
  /\bworked\s+example/i,
  /\btry\s+it\b/i,
  /\bpractice\b/i,
  /\bcheck\s+(?:your\s+)?understanding\b/i,
  /\bexit\s+ticket\b/i,
  /\bkey\s+terms?\b/i,
  /\bvocabulary\b/i,
  /\breview\s+questions?\b/i,
  /\banswer\s+key\b/i,
  /\bunit\s+\d+/i,
  /\blesson\s+\d+/i,
  /\bstandards?\b/i,
  /\bcommon\s+core\b/i,
  /\bngss\b/i,
  /\bstep\s+\d+/i,
  /\bexample\s+\d+/i,
];

export type EducationalStructuralScan = {
  pedagogySignalCount: number;
  matchedSignals: string[];
  issues: string[];
};

/**
 * Cheap structural scan — does not replace the LLM instructional quality check.
 * Fails only when a substantial educational book has *no* pedagogical signals.
 */
export function scanEducationalPedagogySignals(content: string): EducationalStructuralScan {
  const matched = new Set<string>();
  for (const re of PEDAGOGY_SIGNAL_PATTERNS) {
    if (re.test(content)) matched.add(re.source);
  }
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const issues: string[] = [];
  if (wordCount >= 3000 && matched.size === 0) {
    issues.push(
      "Educational book lacks instructional markers (objectives, examples, practice, checks) — school/library reviewers expect a teachable structure, not narrative prose alone",
    );
  }

  // Student take-home textbooks must not read as parent/teacher manuals.
  const adultFacing =
    (content.match(/\byour child\b/gi) || []).length +
    (content.match(/\byour student\b/gi) || []).length +
    (content.match(/\bas a parent\b/gi) || []).length +
    (content.match(/\bin your classroom\b/gi) || []).length +
    (content.match(/\bhomeschool\b/gi) || []).length;
  if (wordCount >= 3000 && adultFacing >= 8) {
    issues.push(
      `Sounds like a parent/teacher guide (${adultFacing} adult-facing phrases) — schoolbooks must be student take-home textbooks written to the learner as "you"`,
    );
  }

  if (wordCount >= 2000) {
    issues.push(...scanEmptyInstructionalSections(content).issues);
  }

  return {
    pedagogySignalCount: matched.size,
    matchedSignals: [...matched],
    issues,
  };
}

export const EDUCATIONAL_EDITORIAL_MIN_SCORE = 6;
export const EDUCATIONAL_INSTRUCTIONAL_MIN_SCORE = 6;
