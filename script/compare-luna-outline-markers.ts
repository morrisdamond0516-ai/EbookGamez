import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { parseOutlineIllustrationSlots, outlineDescriptionKey } from "../shared/outlineIllustrations";

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 724));
const c = d?.content || "";
const slots = parseOutlineIllustrationSlots(d?.outline);

const chapters = [...c.matchAll(/##\s*Chapter\s+(\d+)/gi)];
for (let ch = 0; ch < chapters.length; ch++) {
  const chNum = parseInt(chapters[ch][1], 10);
  const start = chapters[ch].index!;
  const end = ch + 1 < chapters.length ? chapters[ch + 1].index! : c.length;
  const chText = c.slice(start, end);
  const markers = [...chText.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
  const outlineCh = slots.filter((s) => s.chapterNum === chNum);
  console.log(`\nCh${chNum}: content=${markers.length} illus, outline=${outlineCh.length} slots`);
  for (let i = 0; i < markers.length; i++) {
    const inner = markers[i][1].trim();
    const pipe = inner.indexOf(" | ");
    const caption = pipe >= 0 ? inner.slice(pipe + 3).trim() : inner;
    const src = pipe >= 0 ? inner.slice(0, pipe).trim() : "";
    const fname = src.includes("/") ? src.split("/").pop() : "pending";
    const oslot = outlineCh[i];
    const match = oslot && outlineDescriptionKey(oslot.description) === outlineDescriptionKey(caption.split("|")[0]);
    console.log(`  [${i}] ${fname?.slice(0, 28)} ${match ? "outline-ok" : "MISMATCH?"}`);
    if (!match && oslot) {
      console.log(`    caption: ${caption.slice(0, 80)}`);
      console.log(`    outline: ${oslot.description.slice(0, 80)}`);
    }
  }
}
