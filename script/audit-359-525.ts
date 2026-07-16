import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import {
  countResolvedIllustrationMarkers,
  countUnprocessedIllustrationMarkers,
} from "../shared/activityBookContent";
import fs from "fs";
import path from "path";

const ids = [359, 525];
const rows = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, ids));

for (const d of rows) {
  const c = d.content || "";
  const resolved = countResolvedIllustrationMarkers(c);
  const pending = countUnprocessedIllustrationMarkers(c);
  const objstore = (c.match(/\/objstore\/illustrations\//g) || []).length;
  const uploads = (c.match(/\/uploads\/illustrations\//g) || []).length;

  console.log(`\n#${d.id} [${d.status}] ${(d.title || "").slice(0, 55)}`);
  console.log(`  resolved=${resolved} pending=${pending} objstore=${objstore} uploads=${uploads}`);

  const paths = [...c.matchAll(/\[ILLUSTRATION:\s*(\/(?:uploads|objstore)\/illustrations\/[^\s|\]]+)/gi)];
  let localOk = 0;
  let localMiss = 0;
  for (const m of paths) {
    const rel = m[1].replace(/^\/(?:uploads|objstore)\/illustrations\//, "");
    const fp = path.join(process.cwd(), "uploads", "illustrations", rel);
    if (fs.existsSync(fp)) localOk++;
    else localMiss++;
  }
  console.log(`  image files: ${localOk} on disk, ${localMiss} missing locally`);

  const truePending = [...c.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)].filter((m) => {
    const p = m[1].trim();
    return !p.startsWith("/") && !p.startsWith("http");
  });
  console.log(`  true text-only pending: ${truePending.length}`);
  for (const m of truePending.slice(0, 2)) console.log(`    ${m[0].slice(0, 90)}...`);

  const chapters = [...c.matchAll(/##\s*Chapter\s+(\d+)/gi)].map((m) => parseInt(m[1], 10));
  const zeroCh: number[] = [];
  for (const chNum of chapters) {
    const chIdx = chapters.indexOf(chNum);
    const starts = [...c.matchAll(/##\s*Chapter\s+(\d+)/gi)];
    const idx = starts.findIndex((x) => parseInt(x[1], 10) === chNum);
    const start = starts[idx].index!;
    const end = idx + 1 < starts.length ? starts[idx + 1].index! : c.length;
    const chText = c.slice(start, end);
    const n = (chText.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
    if (n === 0) zeroCh.push(chNum);
  }
  if (zeroCh.length) console.log(`  chapters with 0 resolved images: ${zeroCh.join(", ")}`);
}
