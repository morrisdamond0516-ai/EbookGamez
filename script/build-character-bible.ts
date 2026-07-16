/**
 * Build a character visual bible for an existing illustrated fiction draft.
 * Use before re-running illustrations so recurring characters keep the same face/outfit.
 *
 * Run: npm run build:character-bible -- 723
 * Force rebuild: npm run build:character-bible -- 723 --force
 */
import "./load-env.ts";
import { buildAndSaveCharacterBibleForDraft } from "../server/characterBible";

const draftId = parseInt(process.argv[2] || "723", 10);
const force = process.argv.includes("--force");

if (Number.isNaN(draftId)) {
  console.error("Usage: npm run build:character-bible -- <draftId> [--force]");
  process.exit(1);
}

console.log(`[Character Bible] Building for draft #${draftId}${force ? " (force)" : ""}...`);
const bible = await buildAndSaveCharacterBibleForDraft(draftId, { force, contentSample: true });

for (const c of bible.characters) {
  console.log(`\n${c.name}${c.isProtagonist ? " (protagonist)" : ""} — ${c.role}`);
  console.log(`  Look: ${c.fixedAppearance}`);
  console.log(`  Outfit: ${c.defaultOutfit}`);
  if (c.signatureItems.length) console.log(`  Always: ${c.signatureItems.join(", ")}`);
  if (c.outfitVariants?.length) {
    console.log(`  Outfit changes:`);
    for (const v of c.outfitVariants) console.log(`    - ${v.whenToUse}: ${v.outfitDescription}`);
  }
}

console.log(`\n[Character Bible] Saved ${bible.characters.length} character(s) to draft #${draftId}.`);
console.log("Re-run illustrations-only to apply consistent looks.");
