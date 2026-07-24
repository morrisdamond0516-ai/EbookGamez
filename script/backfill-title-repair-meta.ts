/**
 * Backfill ---TITLE_REPAIR--- previousTitles for drafts renamed before
 * titleRepairMetadata existed (so Push to Production can find live rows).
 *
 *   node script/run-tsx.mjs script/backfill-title-repair-meta.ts
 *   node script/run-tsx.mjs script/backfill-title-repair-meta.ts --dry-run
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  getPreviousTitlesFromDescription,
  recordPreviousTitleInDescription,
} from "../shared/titleRepairMetadata";

const DRY = process.argv.includes("--dry-run");

/** Local draft id → original live title(s) before collision repair */
const PREVIOUS_BY_DRAFT_ID: Record<number, string[]> = {
  215: ["12 Principles for Life"],
  186: ["AI Rebellion", "Silicon Ashes: A Post-Human Uprising"],
  37: ["Atomic Productivity"],
  165: ["Breaking Barriers"],
  31: ["Cosmic Dread", "Pantry Rifts and the Things That Listen"],
  146: ["Forgotten Rebels"],
  164: ["Global One"],
  36: ["Manifestation Mastery"],
  162: ["Mastering AI"],
  722: ["Mind Like Water"],
  148: ["Mindful Parenting"],
  153: ["Modern Folklore"],
  717: ["One More Chapter"],
  97: ["Reservoir of Secrets", "Backyard Regen Blueprint: A Thriller of Soil, Water, and Hidden Patterns"],
  250: ["Ripples in Reality"],
  195: ["Sustainable Fashion"],
  721: ["The Anxiety Toolkit"],
  20: ["The Dark Side of the Internet"],
  183: ["The Digital Revolution"],
  719: ["The Forgotten Kingdom"],
  258: ["The Hero Within"],
  265: ["The Labyrinth of Lies"],
  34: ["The Science of Sleep"],
  172: ["The Science of Storytelling"],
  252: ["The Universe of Us"],
  221: ["Threads of Resilience"],
  52: ["Unlocking Peak Performance"],
  227: ["Wanderlist"],
  716: ["When the Stars Go Dark"],
  217: ["Phantom Echoes"],
  139: ["Plant-Based Comfort Foods"],
  230: ["Mental Game Mastery"],
  149: ["Quantum Awakenings"],
  606: ["Shadows of the Streets"],
  724: ["Luna and the Starwhale"],
};

async function main() {
  let updated = 0;
  for (const [idStr, prevs] of Object.entries(PREVIOUS_BY_DRAFT_ID)) {
    const id = Number(idStr);
    const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
    if (!d) {
      console.log(`#${id} missing locally — skip`);
      continue;
    }
    const existing = getPreviousTitlesFromDescription(d.description);
    let desc = d.description || "";
    let changed = false;
    for (const prev of prevs) {
      if (prev.toLowerCase() === (d.title || "").toLowerCase()) continue;
      if (existing.some((t) => t.toLowerCase() === prev.toLowerCase())) continue;
      desc = recordPreviousTitleInDescription(desc, prev);
      changed = true;
    }
    if (!changed) {
      console.log(`#${id} already has previousTitles — ok`);
      continue;
    }
    console.log(`#${id} "${d.title}" ← ${prevs.join(" | ")}`);
    if (!DRY) {
      await db.update(draftEbooks).set({ description: desc }).where(eq(draftEbooks.id, id));
    }
    updated++;
  }
  console.log(`Done. ${DRY ? "would update" : "updated"}=${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
