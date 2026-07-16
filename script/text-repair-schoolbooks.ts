/**
 * Text-only schoolbook gate repairs (no image generation) for 736/737/739/740.
 * Then gate. Use after / beside long illus jobs.
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { runPublishPipelineGate } from "../server/contentStudio";
import {
  parseOutlineIllustrationSlots,
  injectOutlineIllustrationSlots,
  findIllegalAdjacentIllustrations,
  outlineDescriptionKey,
} from "../shared/outlineIllustrations";
import { countUnprocessedIllustrationMarkers } from "../shared/activityBookContent";

const ids = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"))
  .map((a) => parseInt(a, 10))
  .filter((n) => !Number.isNaN(n));
const doGate = process.argv.includes("--gate");
const TARGETS = ids.length ? ids : [736, 737, 739, 740];

function log(m: string) {
  console.log(`[text-repair] ${m}`);
}

function isLonelyIsland(textBetween: string): boolean {
  const wordsBetween = textBetween.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordsBetween > 20) return false;
  const lines = textBetween
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "---");
  return (
    lines.length > 0 &&
    lines.length <= 4 &&
    lines.every(
      (l) =>
        /^[-•*]\s+/.test(l) ||
        /^\d+\.\s+/.test(l) ||
        /^#{1,6}\s/.test(l) ||
        /^\*\*[^*]+\*\*\s*:?\s*$/.test(l),
    )
  );
}

const BRIDGES = [
  "Look at the picture and think about how it connects to what you just learned. Use the details you see to explain the idea in your own words. When you feel ready, try the practice below to show what you know.",
  "The illustration helps you see the idea more clearly. Notice the important parts and how they fit together. Then use what you learned to answer the questions and complete the practice on your own.",
  "Use this figure to check your understanding. Study what is shown and connect it to the lesson steps you read. Practice the skill yourself so you can remember it later.",
  "Pictures in your textbook help you learn step by step. Look carefully at what is happening in the image. Then try the exercises below to practice the same skill.",
];

function bridgeLonely(content: string): { content: string; bridged: number } {
  let updated = content;
  let bridged = 0;
  let safety = 0;
  let bi = 0;
  while (safety++ < 40) {
    const markers = [...updated.matchAll(/\[ILLUSTRATION:[^\]]+\]/g)];
    let fixed = false;
    for (let i = 0; i < markers.length - 1; i++) {
      const end = markers[i].index! + markers[i][0].length;
      const startNext = markers[i + 1].index!;
      const between = updated.substring(end, startNext).trim();
      const words = between.split(/\s+/).filter(Boolean).length;
      if (words > 5 && words < 30 && isLonelyIsland(between)) {
        const bridge = BRIDGES[bi++ % BRIDGES.length];
        updated = updated.substring(0, end) + `\n\n${bridge}\n\n` + updated.substring(end);
        bridged++;
        fixed = true;
        break;
      }
    }
    if (!fixed) break;
  }
  return { content: updated.replace(/\n{3,}/g, "\n\n"), bridged };
}

function fixAdult(content: string): { content: string; fixes: number } {
  let fixes = 0;
  let updated = content;
  const reps: [RegExp, string][] = [
    [/\byour child\b/gi, "you"],
    [/\byour student\b/gi, "you"],
    [/\bas a parent\b/gi, "as you learn"],
    [/\bin your classroom\b/gi, "in class"],
    [/\bhomeschool(?:ing)?\b/gi, "at home"],
    [/\bparents can\b/gi, "you can"],
    [/\bteachers can\b/gi, "you can"],
    [/\bhelp your child\b/gi, "help yourself"],
    [/\bask your student\b/gi, "ask yourself"],
    [/\bwith your child\b/gi, "on your own"],
    [/\bfor your child\b/gi, "for yourself"],
    [/\bhave your child\b/gi, "try to"],
    [/\blet your child\b/gi, "try to"],
    [/\bguide your child\b/gi, "practice"],
    [/\byour learner\b/gi, "you"],
  ];
  for (const [re, rep] of reps) {
    updated = updated.replace(re, (match) => {
      fixes++;
      if (match[0] === match[0].toUpperCase()) return rep.charAt(0).toUpperCase() + rep.slice(1);
      return rep;
    });
  }
  return { content: updated, fixes };
}

function injectMissing(content: string, outline: string | null | undefined) {
  const slots = parseOutlineIllustrationSlots(outline);
  if (!slots.length) return { content, injected: 0 };
  const chapters = [...content.matchAll(/##\s*Chapter\s+(\d+)/gi)];
  const empty = new Set<number>();
  for (let i = 0; i < chapters.length; i++) {
    const chNum = parseInt(chapters[i][1], 10);
    const start = chapters[i].index!;
    const end = i + 1 < chapters.length ? chapters[i + 1].index! : content.length;
    const ch = content.substring(start, end);
    const resolved = (ch.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
    if (resolved === 0 && slots.some((s) => s.chapterNum === chNum)) empty.add(chNum);
  }
  if (!empty.size) return { content, injected: 0 };
  return injectOutlineIllustrationSlots(
    content,
    slots.filter((s) => empty.has(s.chapterNum)),
  );
}

for (const id of TARGETS) {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  if (!d?.content) {
    log(`#${id} skip — no content`);
    continue;
  }
  let content = d.content;
  const adult = fixAdult(content);
  content = adult.content;
  const inject = injectMissing(content, d.outline);
  content = inject.content;
  const bridge = bridgeLonely(content);
  content = bridge.content;
  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, id));
  const pending = countUnprocessedIllustrationMarkers(content);
  log(
    `#${id} adult=${adult.fixes} injected=${inject.injected} bridged=${bridge.bridged} pendingIllus=${pending}`,
  );

  if (doGate) {
    const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
    const gate = await runPublishPipelineGate(fresh!, { strict: true });
    log(`#${id} gate=${gate.pass ? "PASS" : "FAIL"}`);
    for (const iss of gate.issues.slice(0, 8)) log(`  - ${iss}`);
  }
}

process.exit(0);
