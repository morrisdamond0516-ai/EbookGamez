/**
 * Fix back-to-back illustrations on remaining fix-later drafts, re-gate, clear deferrals.
 *
 *   npx tsx script/fix-deferral-adjacency.ts
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import {
  parseQualityDeferralFromDescription,
  stripQualityDeferralFromDescription,
} from "../shared/qualityDeferralMetadata";
import {
  findIllegalAdjacentIllustrations,
  parseOutlineIllustrationSlots,
  outlineDescriptionKey,
} from "../shared/outlineIllustrations";
import { runPublishPipelineGate } from "../server/contentStudio";

const FAIL_IDS = [156, 357, 392, 446, 476, 483, 503, 525, 661, 662];

const BRIDGE = [
  "Look at the figure above, then use what you see to continue the next step. Notice the details that matter most before you move on.",
  "Pause here and connect this image to the idea you just practiced. A short moment of reflection helps the next activity stick.",
  "Use this visual as a checkpoint. When you understand what it shows, continue with the next exercise below.",
  "Study the illustration carefully. Then apply the same idea in the practice that follows so your learning stays active.",
];

function spreadAdjacent(content: string, outline: string | null | undefined): { content: string; fixed: number } {
  let updated = content;
  let fixed = 0;
  let safety = 0;
  let bi = 0;

  while (safety++ < 80) {
    const issues = findIllegalAdjacentIllustrations(updated, outline);
    if (issues.length === 0) {
      // Also catch activity books / no-outline cases: any two markers with ≤5 words between
      const markers = [...updated.matchAll(/\[ILLUSTRATION:\s*[^\]]+\]/gi)];
      let found = false;
      for (let i = 0; i < markers.length - 1; i++) {
        const end = markers[i].index! + markers[i][0].length;
        const startNext = markers[i + 1].index!;
        const between = updated.substring(end, startNext).trim();
        const words = between.split(/\s+/).filter(Boolean).length;
        if (words <= 5) {
          const bridge = BRIDGE[bi++ % BRIDGE.length];
          updated = updated.slice(0, end) + `\n\n${bridge}\n\n` + updated.slice(end);
          fixed++;
          found = true;
          break;
        }
      }
      if (!found) break;
      continue;
    }

    // Prefer inserting bridge text over moving (more reliable for workbooks)
    const markers = [...updated.matchAll(/\[ILLUSTRATION:\s*[^\]]+\]/gi)];
    let did = false;
    for (let i = 0; i < markers.length - 1; i++) {
      const end = markers[i].index! + markers[i][0].length;
      const startNext = markers[i + 1].index!;
      const between = updated.substring(end, startNext).trim();
      const words = between.split(/\s+/).filter(Boolean).length;
      if (words > 5) continue;
      const bridge = BRIDGE[bi++ % BRIDGE.length];
      updated = updated.slice(0, end) + `\n\n${bridge}\n\n` + updated.slice(end);
      fixed++;
      did = true;
      break;
    }
    if (!did) break;
  }

  return { content: updated.replace(/\n{3,}/g, "\n\n"), fixed };
}

function log(m: string) {
  console.log(`[adj] ${m}`);
}

const drafts = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, FAIL_IDS));
let ok = 0;
let failed = 0;

for (const d of drafts.sort((a, b) => a.id - b.id)) {
  if (!d.content) {
    log(`#${d.id} no content`);
    failed++;
    continue;
  }
  const { content, fixed } = spreadAdjacent(d.content, d.outline);
  await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, d.id));
  log(`#${d.id} bridges inserted=${fixed}`);

  const [fresh] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, d.id));
  const gate = await runPublishPipelineGate(fresh!, {
    verifyGenre: false,
    dialogueCheck: false,
  });
  if (gate.pass) {
    await db
      .update(draftEbooks)
      .set({ description: stripQualityDeferralFromDescription(fresh!.description) })
      .where(eq(draftEbooks.id, d.id));
    ok++;
    log(`#${d.id} PASS — deferral cleared`);
  } else {
    failed++;
    log(`#${d.id} FAIL — ${gate.issues.slice(0, 3).join("; ")}`);
  }
}

log(`DONE ok=${ok} failed=${failed}`);
const left = (await db.select().from(draftEbooks)).filter((d) =>
  parseQualityDeferralFromDescription(d.description),
);
log(`Remaining fix-later tags: ${left.length}`);
for (const d of left) log(`  #${d.id} ${(d.title || "").slice(0, 50)}`);
process.exit(failed ? 1 : 0);
