import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq, sql, or, like } from "drizzle-orm";
import fs from "fs";
import path from "path";

const file = "ai-bg-atmospheric-cinema-1783742279009.png";
const localPath = path.join(process.cwd(), "uploads", "covers", file);
console.log("File exists:", fs.existsSync(localPath), localPath);

const pointed = await db
  .select({
    id: draftEbooks.id,
    title: draftEbooks.title,
    coverUrl: draftEbooks.coverUrl,
    backgroundUrl: draftEbooks.backgroundUrl,
    coverStyleId: draftEbooks.coverStyleId,
  })
  .from(draftEbooks)
  .where(
    or(
      like(draftEbooks.coverUrl, `%${file}%`),
      like(draftEbooks.backgroundUrl, `%${file}%`),
      like(draftEbooks.coverUrl, "%atmospheric-cinema%"),
      like(draftEbooks.backgroundUrl, "%atmospheric-cinema%"),
    ),
  );

console.log("\nDrafts pointing at atmospheric files:", pointed.length);
for (const r of pointed) {
  console.log(`#${r.id} ${r.title} style=${r.coverStyleId}`);
  console.log(`  cover=${r.coverUrl}`);
  console.log(`  bg=${r.backgroundUrl}`);
}

const styled = await db
  .select({
    id: draftEbooks.id,
    title: draftEbooks.title,
    coverUrl: draftEbooks.coverUrl,
    backgroundUrl: draftEbooks.backgroundUrl,
    coverStyleId: draftEbooks.coverStyleId,
  })
  .from(draftEbooks)
  .where(eq(draftEbooks.coverStyleId, "atmospheric-cinema"));

console.log("\nAll atmospheric-cinema style drafts:", styled.length);
for (const r of styled) {
  console.log(
    `#${r.id} | ${String(r.title).slice(0, 50)} | cover=${r.coverUrl ? "Y" : "N"} bg=${r.backgroundUrl ? "Y" : "N"}`,
  );
}

const [d729] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 729));
console.log("\n#729:", {
  title: d729?.title,
  coverUrl: d729?.coverUrl,
  backgroundUrl: d729?.backgroundUrl,
  coverStyleId: d729?.coverStyleId,
});
