import { useState } from "react";

const ts = Date.now();
const u = (p: string) => `/uploads/ads/${p}?v=${ts}`;

const GROUPS = [
  {
    name: "Catalog",
    slug: "catalog",
    desc: "Ebook Store — general catalog ads",
    samples: [
      { label: "Landscape 1200×628",  url: u("catalog/catalog-1-landscape-1200x628.png") },
      { label: "Square 1200×1200",    url: u("catalog/catalog-1-square-1200x1200.png") },
      { label: "Portrait 960×1200",   url: u("catalog/catalog-1-portrait-960x1200.png") },
    ],
    count: 21,
  },
  {
    name: "Games",
    slug: "games",
    desc: "HTML5 Games & Gaming Content",
    samples: [
      { label: "Landscape 1200×628",  url: u("games/games-1-landscape-1200x628.png") },
      { label: "Square 1200×1200",    url: u("games/games-1-square-1200x1200.png") },
      { label: "Portrait 960×1200",   url: u("games/games-1-portrait-960x1200.png") },
    ],
    count: 21,
  },
  {
    name: "Downloads",
    slug: "downloads",
    desc: "Game Downloads Hub",
    samples: [
      { label: "Landscape 1200×628",  url: u("downloads/downloads-1-landscape-1200x628.png") },
      { label: "Square 1200×1200",    url: u("downloads/downloads-1-square-1200x1200.png") },
      { label: "Portrait 960×1200",   url: u("downloads/downloads-1-portrait-960x1200.png") },
    ],
    count: 21,
  },
  {
    name: "Guides",
    slug: "guides",
    desc: "Gaming & Hobby Guides / Strategy",
    samples: [
      { label: "Landscape 1200×628",  url: u("guides/guides-1-landscape-1200x628.png") },
      { label: "Square 1200×1200",    url: u("guides/guides-1-square-1200x1200.png") },
      { label: "Portrait 960×1200",   url: u("guides/guides-1-portrait-960x1200.png") },
    ],
    count: 21,
  },
  {
    name: "Reading Pass",
    slug: "reading-pass",
    desc: "Subscription / Reading Pass",
    samples: [
      { label: "Landscape 1200×628",  url: u("reading-pass/reading-pass-1-landscape-1200x628.png") },
      { label: "Square 1200×1200",    url: u("reading-pass/reading-pass-1-square-1200x1200.png") },
      { label: "Portrait 960×1200",   url: u("reading-pass/reading-pass-1-portrait-960x1200.png") },
    ],
    count: 21,
  },
];

export default function AdPreview() {
  const [lb, setLb] = useState<string | null>(null);

  return (
    <div style={{ background: "#0d0a05", minHeight: "100vh", padding: "40px 24px", fontFamily: "serif" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ color: "#cca633", fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 10 }}>EbookGamez · Google Ads Image Assets</div>
          <h1 style={{ color: "#e8c84a", fontSize: 28, fontWeight: "bold", margin: "0 0 10px" }}>Full Google Ads Set — Cinematic Gold Treatment</h1>
          <p style={{ color: "#7a6028", fontSize: 13, margin: "0 0 8px" }}>
            5 campaign groups · 21 images per group · 3 sizes each (Landscape 1200×628, Square 1200×1200, Portrait 960×1200)<br/>
            Source material: game artwork from the site (clean — no text) · Logos included
          </p>
          <p style={{ color: "#5a4418", fontSize: 12, margin: "0 0 24px" }}>Showing 3 sample images per group. Download ZIP for all 105 images + logos.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/exports/ebookgamez-google-ads-full.zip"
              download
              style={{ display: "inline-block", padding: "11px 32px", background: "linear-gradient(135deg,#8a6518,#cca633,#e8c84a,#b8942a)", color: "#0d0a05", fontWeight: "bold", fontSize: 13, borderRadius: 6, textDecoration: "none" }}
            >
              ⬇ Download Full Set — 105 Images + Logos (ZIP)
            </a>
            <a
              href="/exports/ebookgamez-ads-recolored.zip"
              download
              style={{ display: "inline-block", padding: "11px 24px", background: "transparent", border: "1px solid #5a4418", color: "#8a6a20", fontSize: 12, borderRadius: 6, textDecoration: "none" }}
            >
              Original 9 Ads (ZIP)
            </a>
          </div>
        </div>

        {GROUPS.map(({ name, slug, desc, samples, count }) => (
          <div key={slug} style={{ marginBottom: 60 }}>
            <div style={{ marginBottom: 16, borderBottom: "1px solid #2a1e08", paddingBottom: 10 }}>
              <h2 style={{ color: "#cca633", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 4px" }}>{name}</h2>
              <div style={{ color: "#5a4418", fontSize: 12 }}>{desc} · {count} images in ZIP (3 sizes × 7 sources)</div>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {samples.map(({ label, url }) => (
                <div key={label} style={{ flex: "1 1 340px", minWidth: 0 }}>
                  <div
                    onClick={() => setLb(url)}
                    style={{ cursor: "zoom-in", border: "1px solid #2a1e08", borderRadius: 7, overflow: "hidden", transition: "border-color 0.15s, box-shadow 0.15s" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#cca633"; el.style.boxShadow = "0 6px 24px rgba(204,166,51,0.18)"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "#2a1e08"; el.style.boxShadow = "none"; }}
                  >
                    <img src={url} alt={label} style={{ width: "100%", display: "block" }} loading="lazy" />
                    <div style={{ padding: "6px 14px", background: "#100c04", color: "#6a5020", fontSize: 11, textAlign: "center" }}>
                      {name} · {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ borderTop: "1px solid #2a1e08", paddingTop: 24, marginTop: 20 }}>
          <h2 style={{ color: "#cca633", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 14px" }}>Logos</h2>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 340px" }}>
              <div onClick={() => setLb("/uploads/ads/logo-square.png")} style={{ cursor: "zoom-in", border: "1px solid #2a1e08", borderRadius: 7, overflow: "hidden", background: "#1a1208" }}>
                <img src="/uploads/ads/logo-square.png" alt="Square Logo" style={{ width: "100%", display: "block" }} />
                <div style={{ padding: "6px 14px", background: "#100c04", color: "#6a5020", fontSize: 11, textAlign: "center" }}>Logo · Square 1:1 (1200×1200)</div>
              </div>
            </div>
            <div style={{ flex: "2 1 500px" }}>
              <div onClick={() => setLb("/uploads/ads/logo-landscape.png")} style={{ cursor: "zoom-in", border: "1px solid #2a1e08", borderRadius: 7, overflow: "hidden", background: "#1a1208" }}>
                <img src="/uploads/ads/logo-landscape.png" alt="Landscape Logo" style={{ width: "100%", display: "block" }} />
                <div style={{ padding: "6px 14px", background: "#100c04", color: "#6a5020", fontSize: 11, textAlign: "center" }}>Logo · Landscape 4:1 (1200×300)</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {lb && (
        <div
          onClick={() => setLb(null)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.96)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out", padding: 24 }}
        >
          <img src={lb} alt="Full size" style={{ maxWidth: "96vw", maxHeight: "96vh", objectFit: "contain" }} />
          <div style={{ position: "fixed", top: 18, right: 22, color: "#cca633", fontSize: 26, userSelect: "none" }}>✕</div>
        </div>
      )}
    </div>
  );
}
