import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { inArray, eq } from "drizzle-orm";
import {
  parseOutlineIllustrationSlots,
  resetContentIllustrationsToOutline,
  injectOutlineIllustrationSlots,
} from "../shared/outlineIllustrations";
import {
  generateIllustrations,
  runPublishPipelineGate,
} from "../server/contentStudio";

const IDS = [729, 730, 731, 732];
const dryRun = process.argv.includes("--dry-run");

const rows = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, IDS));

for (const draft of rows.sort((a, b) => a.id - b.id)) {
  const title = draft.title || `Draft #${draft.id}`;
  console.log(`\n======== #${draft.id} ${title} ========`);

  const slots = parseOutlineIllustrationSlots(draft.outline);
  const byCh = new Map<number, number>();
  for (const s of slots) byCh.set(s.chapterNum, (byCh.get(s.chapterNum) || 0) + 1);
  console.log(
    `Outline slots: ${slots.length} across chapters: ${[...byCh.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([c, n]) => `ch${c}=${n}`)
      .join(", ")}`,
  );

  let content = draft.content || "";
  if (!content.trim()) {
    console.log("No content — skip");
    continue;
  }

  // Prefer reset (strip + place outline-exact markers per chapter)
  if (slots.some((s) => s.chapterNum > 0)) {
    const reset = resetContentIllustrationsToOutline(content, draft.outline);
    content = reset.content;
    console.log(`Reset from outline: ${reset.slotCount} slots, stripped ${reset.stripped} old markers`);
  } else if (slots.length > 0) {
    content = content.replace(/\[ILLUSTRATION:\s*[^\]]+\]/gi, "").replace(/\n{3,}/g, "\n\n");
    const inj = injectOutlineIllustrationSlots(content, slots);
    content = inj.content;
    console.log(`Injected ${inj.injected}/${slots.length} global outline slots`);
  } else {
    console.log("No outline slots — cannot illustrate from outline");
    continue;
  }

  const pending = [...content.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].filter((m) => {
    const p = m[1].trim();
    return !p.startsWith("/") && !p.startsWith("http");
  }).length;
  console.log(`Pending markers to generate: ${pending}`);

  if (dryRun) {
    console.log("[dry-run] skip generate + gate");
    continue;
  }

  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));

  if (pending === 0) {
    console.log("Nothing to generate");
    continue;
  }

  try {
    content = await generateIllustrations(
      content,
      draft.genre || "Textbooks",
      title,
      draft.id,
    );
    await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));
    const resolved =
      (content.match(/\/uploads\/illustrations\//gi) || []).length +
      (content.match(/\/objstore\/illustrations\//gi) || []).length;
    const stillPending = [...content.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].filter((m) => {
      const p = m[1].trim();
      return !p.startsWith("/") && !p.startsWith("http");
    }).length;
    console.log(`After generate: resolved=${resolved} stillPending=${stillPending}`);
  } catch (e: any) {
    console.error(`Illustration generation failed:`, e?.message || e);
    continue;
  }

  const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draft.id));
  const gate = await runPublishPipelineGate(fresh!, { strict: true });
  console.log(
    `Strict gate: ${gate.pass ? "PASS" : "FAIL"} — ${(gate.issues || []).slice(0, 8).join("; ")}${
      (gate.issues || []).length > 8 ? "..." : ""
    }`,
  );
  if (gate.pass && fresh!.status !== "ready" && fresh!.status !== "published") {
    await db.update(draftEbooks).set({ status: "ready" }).where(eq(draftEbooks.id, draft.id));
    console.log(`Promoted to ready`);
  }
}

console.log("\nDone.");
process.exit(0);
