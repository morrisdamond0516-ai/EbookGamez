/**
 * Restore cover_style_id values cleared by quarantine-lost-covers.
 * Source: audit snapshot before the mistaken bulk clear.
 *
 * Run: npx tsx --import ./script/load-env.ts script/restore-cover-style-ids.ts
 */
import "./load-env.ts";
import fs from "fs";
import path from "path";
import pg from "pg";

/** Known styles for the 23 locally lost covers (from audit before quarantine). */
const LOST_COVER_STYLES: Record<number, string> = {
  646: "dalle3-vivid",
  648: "dalle3-vivid",
  707: "dalle3-vivid",
  708: "cinematic-openai",
  709: "cinematic-openai",
  710: "dalle3-vivid",
  711: "dalle3-vivid",
  712: "dalle3-vivid",
  713: "dalle3-vivid",
  714: "dalle3-vivid",
  715: "cinematic-openai",
  716: "dalle3-vivid",
  717: "cinematic-openai",
  718: "dalle3-vivid",
  719: "dalle3-vivid",
  720: "dalle3-vivid",
  721: "dalle3-vivid",
  722: "cinematic-openai",
  723: "dalle3-vivid",
  724: "dalle3-vivid",
  725: "cinematic-openai",
  726: "dalle3-vivid",
  727: "dalle3-vivid",
  728: "dalle3-vivid",
};

function parseAuditFile(filePath: string): Map<number, string> {
  const map = new Map<number, string>();
  if (!fs.existsSync(filePath)) return map;
  const text = fs.readFileSync(filePath, "utf8");
  const re = /^#(\d+)\s.+style=([a-z0-9-]+)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    map.set(parseInt(m[1], 10), m[2]);
  }
  return map;
}

const auditPath = path.join(process.cwd(), "script", "cover-style-audit-snapshot.txt");
const fromAudit = parseAuditFile(auditPath);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let restored = 0;
const allStyles = new Map<number, string>([...fromAudit, ...Object.entries(LOST_COVER_STYLES).map(([k, v]) => [parseInt(k, 10), v] as const)]);

for (const [id, styleId] of allStyles) {
  const r = await client.query(
    `UPDATE draft_ebooks SET cover_style_id = $1 WHERE id = $2 AND (cover_style_id IS NULL OR cover_style_id = '') RETURNING id`,
    [styleId, id],
  );
  if (r.rowCount) restored++;
}

console.log(`Restored cover_style_id on ${restored} draft(s) (${allStyles.size} mappings available)`);
await client.end();
