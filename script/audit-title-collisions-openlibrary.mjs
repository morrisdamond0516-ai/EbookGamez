/**
 * Spot-check distinctive live titles against Open Library search
 * (free, no API key) for possible existing-book collisions.
 */
const LIVE = "https://ebookgamez.com";

async function openLibraryHits(title) {
  const url =
    "https://openlibrary.org/search.json?title=" +
    encodeURIComponent(title) +
    "&limit=5";
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) return { error: r.status, docs: [] };
  const j = await r.json();
  return {
    numFound: j.numFound,
    docs: (j.docs || []).slice(0, 5).map((d) => ({
      title: d.title,
      author: (d.author_name || []).slice(0, 2).join(", "),
      first: d.first_publish_year,
    })),
  };
}

function looksLikeExactOrVeryClose(ours, theirs) {
  const a = ours.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const b = theirs.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (a === b) return "EXACT";
  if (a.length >= 12 && (b.includes(a) || a.includes(b))) return "CONTAINS";
  // high word overlap
  const aw = new Set(a.split(" ").filter((w) => w.length > 2));
  const bw = b.split(" ").filter((w) => w.length > 2);
  if (aw.size < 3) return null;
  const hit = bw.filter((w) => aw.has(w)).length;
  if (hit >= Math.min(aw.size, 4) && hit / aw.size >= 0.75) return "SIMILAR";
  return null;
}

const all = await (await fetch(`${LIVE}/api/books?limit=1000`)).json();
const books = Array.isArray(all) ? all : all.books || [];

// Focus on story-like genres (highest collision risk for branded titles)
const fictionish = books.filter((b) => {
  const g = (b.genre || "").toLowerCase();
  return (
    g.includes("fiction") ||
    g.includes("fantasy") ||
    g.includes("romance") ||
    g.includes("thriller") ||
    g.includes("mystery") ||
    g.includes("horror") ||
    g.includes("adventure") ||
    g.includes("children") ||
    g.includes("young adult") ||
    g.includes("cozy")
  );
});

// Prefer shorter distinctive titles (more likely brand collisions)
const sample = fictionish
  .map((b) => b.title)
  .filter((t) => t && t.length <= 60 && !/complete school year/i.test(t))
  .sort((a, b) => a.length - b.length);

// Dedupe and take a workable sample + force-check known recent titles
const force = [
  "Luna and the Starwhale",
  "Captain Whiskers and the Pirate Moon",
  "The Dragon Academy Trials",
  "The Ember Bond",
  "The Neighbor's Lie",
  "The Last Upload",
  "The Secret Library Under the Stairs",
  "Lanterns in the Moss",
];
const unique = [...new Set([...force, ...sample.slice(0, 40)])];

console.log(`Checking ${unique.length} titles via Open Library…\n`);

const flags = [];
for (const title of unique) {
  try {
    const res = await openLibraryHits(title);
    let worst = null;
    let matchDoc = null;
    for (const d of res.docs || []) {
      const kind = looksLikeExactOrVeryClose(title, d.title || "");
      if (kind === "EXACT") {
        worst = "EXACT";
        matchDoc = d;
        break;
      }
      if (kind && worst !== "EXACT") {
        worst = kind;
        matchDoc = d;
      }
    }
    if (worst) {
      flags.push({ ours: title, kind: worst, match: matchDoc, numFound: res.numFound });
      console.log(`[${worst}] "${title}" ≈ "${matchDoc.title}" by ${matchDoc.author || "?"} (${matchDoc.first || "?"})`);
    } else {
      console.log(`[ok] ${title.slice(0, 55)}`);
    }
    await new Promise((r) => setTimeout(r, 200)); // be polite
  } catch (e) {
    console.log(`[err] ${title}: ${e.message}`);
  }
}

console.log(`\n=== SUMMARY: ${flags.length} possible collisions in sample of ${unique.length} ===`);
for (const f of flags) {
  console.log(JSON.stringify(f));
}
