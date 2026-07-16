import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 682));
const c = d?.content || "";
const idx1 = c.indexOf("ILLUSTRATION");
const idx2 = c.indexOf("IMAGE:");
console.log("ILLUSTRATION idx", idx1);
if (idx1 >= 0) console.log(c.slice(Math.max(0, idx1 - 20), idx1 + 200));
console.log("IMAGE: idx", idx2);
if (idx2 >= 0) console.log(c.slice(Math.max(0, idx2 - 20), idx2 + 200));

const markers = [...c.matchAll(/\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):\s*([^\]]*)\]/gi)];
console.log("bracket markers", markers.length);
for (const m of markers) console.log(m[0].slice(0, 150));

// also partial/broken
const partial = [...c.matchAll(/\[ILLUSTRATION:[^\n]{0,200}/gi)];
console.log("partial", partial.length);
for (const m of partial) console.log(m[0]);
