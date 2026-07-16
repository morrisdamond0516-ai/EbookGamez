import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { parseOutlineIllustrationSlots } from "../shared/outlineIllustrations";

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 724));
const c = d?.content || "";
const slots = parseOutlineIllustrationSlots(d?.outline);

const markers = [...c.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
console.log(`#724 markers: ${markers.length}\n`);

const suspect = /telescope|educational|diagram|infographic|textbook|labeled|classroom|science equipment|astronomy|observatory|star chart|constellation map/i;

for (let i = 0; i < markers.length; i++) {
  const full = markers[i][0];
  const inner = markers[i][1].trim();
  const idx = markers[i].index!;
  const pipe = inner.indexOf(" | ");
  const src = pipe >= 0 ? inner.slice(0, pipe).trim() : inner;
  const caption = pipe >= 0 ? inner.slice(pipe + 3).trim() : inner;
  const isUrl = src.startsWith("/") || src.startsWith("http");
  const text = caption + " " + inner;
  const before = c.slice(Math.max(0, idx - 300), idx).replace(/\n/g, " ");
  const after = c.slice(idx + full.length, idx + full.length + 300).replace(/\n/g, " ");

  const flags: string[] = [];
  if (suspect.test(text)) flags.push("SUSPECT_TEXT");
  if (!isUrl) flags.push("PENDING");

  if (flags.length || i < 5) {
    console.log(`--- #${i} ${flags.join(" ") || "ok"} ---`);
    console.log(`  ${isUrl ? src.split("/").pop() : "TEXT"}: ${caption.slice(0, 120)}`);
    if (suspect.test(text)) {
      console.log(`  BEFORE: ...${before.slice(-120)}`);
      console.log(`  AFTER: ${after.slice(0, 120)}...`);
    }
  }
}

console.log(`\noutline slots: ${slots.length}`);
for (const s of slots.filter((x) => suspect.test(x.description)).slice(0, 5)) {
  console.log(`  outline ch${s.chapterNum}: ${s.description.slice(0, 100)}`);
}
