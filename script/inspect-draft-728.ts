import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [d] = await db
    .select({
      id: draftEbooks.id,
      title: draftEbooks.title,
      genre: draftEbooks.genre,
      status: draftEbooks.status,
      content: draftEbooks.content,
    })
    .from(draftEbooks)
    .where(eq(draftEbooks.id, 728));

  if (!d) {
    console.log("draft 728 not found");
    return;
  }

  const c = d.content || "";
  const ch1 = c.match(/##\s*Chapter\s+1[\s\S]*?(?=##\s*Chapter\s+2|$)/i)?.[0] || "";
  console.log("title:", d.title, "genre:", d.genre, "status:", d.status);
  console.log("ch1 length:", ch1.length);

  const lines = ch1.split("\n");
  console.log("--- sample lines 70-120 ---");
  console.log(lines.slice(70, 120).join("\n"));

  const ascii = lines.filter((l) => {
    const t = l.trim();
    if (t.length < 8) return false;
    const alpha = (t.match(/[a-zA-Z]/g) || []).length;
    return alpha < 3 && /[|+\-_#.oO]/.test(t);
  });
  console.log("ascii-like lines:", ascii.length);
  for (const a of ascii.slice(0, 5)) console.log("  ", a);

  const illus = [...ch1.matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)];
  console.log("illustration markers in ch1:", illus.length);
  for (const m of illus.slice(0, 6)) {
    const src = m[1].trim().substring(0, 100);
    console.log("  ", src);
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
