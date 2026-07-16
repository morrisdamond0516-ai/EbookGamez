import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getVisualPublishBlockers } from "../server/contentStudio";

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 724));
if (!d) process.exit(1);
const c = d.content || "";

console.log(`#724 [${d.status}] ${d.genre}`);
console.log(`title: ${d.title}`);
console.log(`publish blockers:`, getVisualPublishBlockers(c, d.genre));

const markers = [...c.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
console.log(`\nmarkers: ${markers.length}`);
for (const m of markers) {
  const full = m[0];
  const inner = m[1].trim();
  const pipe = inner.indexOf(" | ");
  const src = pipe >= 0 ? inner.slice(0, pipe).trim() : inner;
  const caption = pipe >= 0 ? inner.slice(pipe + 3).trim() : "";
  const isUrl = src.startsWith("/") || src.startsWith("http");
  const text = (caption || inner).toLowerCase();
  const flags = [];
  if (/telescope|educational|diagram|infographic|textbook|labeled|chart/.test(text)) flags.push("SUSPECT");
  if (!isUrl) flags.push("PENDING");
  console.log(`\n  ${flags.join(" ")} ${isUrl ? src.split("/").pop() : "TEXT"}`);
  console.log(`    ${(caption || inner).slice(0, 140)}`);
}

// surrounding text for telescope hits
const low = c.toLowerCase();
let idx = 0;
while ((idx = low.indexOf("telescope", idx)) >= 0) {
  console.log("\n--- telescope in content ---");
  console.log(c.slice(Math.max(0, idx - 120), idx + 120).replace(/\n/g, " "));
  idx += 9;
}
