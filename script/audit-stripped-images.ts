import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const STRIPPED_PLACEHOLDER = /high-quality illustration needed here/i;
const RESOLVED_RE = /\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\/[^\]]+\]/gi;
const PENDING_RE = /\[ILLUSTRATION:\s*(?!\/|http)([^\]]+)\]/gi;

const rows = await db
  .select({ id: draftEbooks.id, title: draftEbooks.title, status: draftEbooks.status, content: draftEbooks.content })
  .from(draftEbooks)
  .where(sql`${draftEbooks.content} LIKE '%[ILLUSTRATION:%'`);

type Row = { id: number; title: string; status: string; resolved: number; stripped: number; pending: number; missingLocal: number };

const report: Row[] = [];
const illustDir = path.join(process.cwd(), "uploads", "illustrations");

for (const d of rows) {
  const c = d.content || "";
  const resolved = (c.match(RESOLVED_RE) || []).length;
  const stripped = (c.match(STRIPPED_PLACEHOLDER) || []).length;
  const pending = [...c.matchAll(PENDING_RE)].length;

  let missingLocal = 0;
  const paths = [...c.matchAll(/\[ILLUSTRATION:\s*(\/(?:uploads|objstore)\/illustrations\/[^\s|\]]+)/gi)];
  for (const m of paths) {
    const rel = m[1].replace(/^\/objstore\/illustrations\//, "").replace(/^\/uploads\/illustrations\//, "");
    const local = path.join(illustDir, rel);
    if (!fs.existsSync(local)) missingLocal++;
  }

  if (resolved > 0 || stripped > 0 || pending > 5) {
    report.push({
      id: d.id,
      title: (d.title || "").slice(0, 48),
      status: d.status || "",
      resolved,
      stripped,
      pending,
      missingLocal,
    });
  }
}

console.log("=== Books with illustration state ===\n");
const damaged = report.filter((r) => r.stripped > 0 || (r.resolved > 0 && r.missingLocal > r.resolved * 0.5) || (r.pending > 0 && r.resolved === 0));
for (const r of report.sort((a, b) => a.id - b.id)) {
  const flag = r.stripped > 0 ? " STRIPPED" : r.missingLocal > 0 && r.resolved > 0 ? " FILES_MISSING" : r.pending > 10 ? " FAKE_PENDING" : "";
  console.log(
    `#${r.id} [${r.status}] resolved=${r.resolved} stripped=${r.stripped} pending=${r.pending} missingLocalFiles=${r.missingLocal}${flag} — ${r.title}`,
  );
}
console.log(`\nTotal with any illustration markers: ${rows.length}`);
console.log(`With stripped placeholders: ${report.filter((r) => r.stripped > 0).length}`);
console.log(`Local illust dir exists: ${fs.existsSync(illustDir)}`);
if (fs.existsSync(illustDir)) {
  const files = fs.readdirSync(illustDir).filter((f) => f.endsWith(".png"));
  console.log(`Local illustration PNG count: ${files.length}`);
}
