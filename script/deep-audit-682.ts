import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { unwrapNonImageIllustrationMarkers } from "../shared/activityBookContent";

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 682));
if (!d) process.exit(1);

for (const field of ["content", "outline", "description"] as const) {
  const text = (d[field] as string) || "";
  const markers = [...text.matchAll(/\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):\s*([^\]]+)\]/gi)];
  const pending = markers.filter((m) => {
    const p = m[1].trim();
    return !p.startsWith("/") && !p.startsWith("http");
  });
  console.log(`${field}: total=${markers.length} pending=${pending.length}`);
  for (const m of pending.slice(0, 5)) console.log(`  ${m[0].slice(0, 120)}`);
}

// Force unwrap on content again and save if anything left
const c = d.content || "";
const u = unwrapNonImageIllustrationMarkers(c);
if (u.removed > 0) {
  await db.update(draftEbooks).set({ content: u.content }).where(eq(draftEbooks.id, 682));
  console.log("saved extra unwrap:", u.removed);
} else {
  console.log("content already clean");
}

// sample lines that might render as illustration in reader (grep-like)
const lines = c.split("\n");
const suspicious = lines.filter((l) =>
  /\[ILLUSTRATION|\[IMAGE|high-quality illustration|illustration needed/i.test(l),
);
console.log("suspicious lines:", suspicious.length);
for (const l of suspicious.slice(0, 5)) console.log(l.slice(0, 120));
