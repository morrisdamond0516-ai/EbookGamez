import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { sql, inArray } from "drizzle-orm";
import { parseOutlineIllustrationSlots } from "../shared/outlineIllustrations";

const RESEARCH = [706, 707, 708, 709, 710, 711, 712, 713, 714, 715, 716, 717, 718, 719, 720, 721, 722, 723, 724, 725, 726, 727, 728];

const rows = await db
  .select({
    id: draftEbooks.id,
    title: draftEbooks.title,
    genre: draftEbooks.genre,
    status: draftEbooks.status,
    outline: draftEbooks.outline,
    content: draftEbooks.content,
  })
  .from(draftEbooks)
  .where(inArray(draftEbooks.id, RESEARCH));

console.log(`Research batch: ${rows.length} drafts\n`);
for (const d of rows) {
  const c = d.content || "";
  const slots = parseOutlineIllustrationSlots(d.outline);
  const resolved = (c.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
  const pending = [...c.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].filter((m) => {
    const p = m[1].trim();
    return !p.startsWith("/") && !p.startsWith("http");
  }).length;
  console.log(
    `#${d.id} [${d.status}] outline_slots=${slots.length} resolved=${resolved} pending=${pending} — ${(d.title || "").slice(0, 42)}`,
  );
}
