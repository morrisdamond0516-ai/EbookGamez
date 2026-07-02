/**
 * Distribution-quality EPUB 3 generator.
 * Produces files that meet Draft2Digital, Smashwords, and Amazon KDP
 * submission requirements — proper metadata, embedded cover, clean CSS,
 * EPUB 3 nav + EPUB 2 NCX fallback, valid XHTML chapters.
 */

import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { db } from "./storage";
import { draftEbooks, books } from "@shared/schema";
import { eq } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ParsedChapter {
  id: string;
  filename: string;
  title: string;
  xhtml: string;
}

interface EpubMeta {
  uuid: string;
  title: string;
  author: string;
  description: string;
  publisher: string;
  language: string;
  genre: string;
  dateModified: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugify(s: string, idx: number): string {
  return `ch${String(idx).padStart(3, "0")}`;
}

/** Convert Markdown paragraph to valid XHTML. */
function paraToXhtml(text: string): string {
  const escaped = xmlEscape(text.trim());
  return escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>");
}

/**
 * Parse the full Markdown content string into chapters.
 * Handles: # Chapter N, ## Heading, plain "Chapter N" prefixes.
 */
function parseChapters(content: string): ParsedChapter[] {
  const paragraphs = content.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chapterPattern = /^#{1,3}\s+(.*)/;
  const plainPattern = /^(Chapter\s+[\dIVXLCDM]+(?:\s*[.:\-—]\s*.*)?|Part\s+[\dIVXLCDM]+(?:\s*[.:\-—]\s*.*)?|Prologue|Epilogue|Foreword|Introduction|Conclusion|Afterword)/i;

  const rawChapters: { title: string; paras: string[] }[] = [];
  let current: { title: string; paras: string[] } = { title: "Introduction", paras: [] };

  for (const para of paragraphs) {
    const mdMatch = para.match(chapterPattern);
    const plainMatch = !mdMatch ? para.match(plainPattern) : null;

    if (mdMatch || (plainMatch && para.split(/\s+/).length <= 8)) {
      if (current.paras.length > 0) rawChapters.push(current);
      const rawTitle = mdMatch ? mdMatch[1] : para;
      // Clean up "Chapter 1. Title" → keep full form
      current = { title: rawTitle.replace(/^#{1,3}\s*/, "").trim(), paras: [] };
    } else {
      current.paras.push(para);
    }
  }
  if (current.paras.length > 0 || rawChapters.length === 0) {
    rawChapters.push(current);
  }

  return rawChapters.map((ch, idx) => {
    const chId = slugify(ch.title, idx + 1);
    const bodyLines: string[] = [];

    for (const para of ch.paras) {
      // Inline image markers
      const illustMatch = para.match(/^\[ILLUSTRATION:\s*(.*?)\]$/);
      if (illustMatch) {
        bodyLines.push(`<div class="illustration"><p class="caption">[Illustration: ${xmlEscape(illustMatch[1])}]</p></div>`);
        continue;
      }
      // Markdown image
      const mdImg = para.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (mdImg) {
        bodyLines.push(`<div class="illustration"><p class="caption">${xmlEscape(mdImg[1])}</p></div>`);
        continue;
      }
      // Scene break
      if (/^(\*{3,}|-{3,}|_{3,}|\*\s*\*\s*\*|—\s*—\s*—)$/.test(para)) {
        bodyLines.push(`<p class="scene-break">* * *</p>`);
        continue;
      }
      // Sub-heading inside chapter (bold-only line or short all-caps)
      const wordCount = para.split(/\s+/).length;
      if (wordCount <= 8 && /^[*_](.+)[*_]$/.test(para)) {
        const inner = xmlEscape(para.replace(/^[*_]+|[*_]+$/g, "").trim());
        bodyLines.push(`<h3>${inner}</h3>`);
        continue;
      }
      // Normal paragraph — handle sub-lines
      if (para.includes("\n")) {
        para.split("\n").filter(Boolean).forEach(line => {
          bodyLines.push(`<p>${paraToXhtml(line)}</p>`);
        });
      } else {
        bodyLines.push(`<p>${paraToXhtml(para)}</p>`);
      }
    }

    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${xmlEscape(ch.title)}</title>
  <link rel="stylesheet" type="text/css" href="../stylesheet.css"/>
</head>
<body>
  <section epub:type="chapter" class="chapter">
    <h1 class="chapter-title">${xmlEscape(ch.title)}</h1>
    ${bodyLines.join("\n    ")}
  </section>
</body>
</html>`;

    return { id: chId, filename: `chapters/${chId}.xhtml`, title: ch.title, xhtml };
  });
}

// ─── File builders ───────────────────────────────────────────────────────────

function buildContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:schemas:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function buildStylesheet(): string {
  return `/* EbookGamez — Distribution ePub Stylesheet */
body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1em;
  line-height: 1.8;
  color: #1a1a1a;
  margin: 0;
  padding: 0;
}
.chapter { margin: 0; padding: 2em 1.5em; }
h1.chapter-title {
  font-size: 1.6em;
  font-weight: bold;
  text-align: center;
  margin: 0 0 2em 0;
  padding-bottom: 0.5em;
  border-bottom: 1px solid #ccc;
  page-break-before: always;
  break-before: page;
}
h2 { font-size: 1.3em; margin: 1.5em 0 0.5em; }
h3 { font-size: 1.1em; font-style: italic; margin: 1.2em 0 0.4em; }
p {
  margin: 0 0 0;
  text-indent: 1.5em;
}
p:first-of-type, p.no-indent { text-indent: 0; }
p.scene-break {
  text-align: center;
  text-indent: 0;
  margin: 1.5em 0;
  letter-spacing: 0.5em;
}
.illustration {
  text-align: center;
  margin: 1.5em 0;
}
p.caption {
  font-size: 0.85em;
  font-style: italic;
  color: #555;
  text-indent: 0;
}
.cover-page {
  text-align: center;
  page-break-after: always;
  break-after: page;
}
.cover-page img { max-width: 100%; height: auto; }
code { font-family: monospace; }
strong { font-weight: bold; }
em { font-style: italic; }`;
}

function buildCoverXhtml(hasCover: boolean, title: string): string {
  const body = hasCover
    ? `<div class="cover-page"><img src="images/cover.jpg" alt="${xmlEscape(title)}" /></div>`
    : `<div class="cover-page"><h1>${xmlEscape(title)}</h1></div>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Cover</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body epub:type="cover">
  ${body}
</body>
</html>`;
}

function buildContentOpf(meta: EpubMeta, chapters: ParsedChapter[], hasCover: boolean): string {
  const manifestItems = chapters.map(ch =>
    `    <item id="${ch.id}" href="${ch.filename}" media-type="application/xhtml+xml"/>`
  ).join("\n");
  const spineItems = chapters.map(ch =>
    `    <itemref idref="${ch.id}"/>`
  ).join("\n");
  const coverManifest = hasCover
    ? `    <item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>\n    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml" properties="svg"/>`
    : `    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
  const coverSpine = `    <itemref idref="cover-page" linear="yes"/>`;
  const coverMeta = hasCover ? `\n    <meta name="cover" content="cover-image"/>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf"
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:dcterms="http://purl.org/dc/terms/"
         version="3.0"
         unique-identifier="book-uuid"
         xml:lang="en">
  <metadata>
    <dc:identifier id="book-uuid">urn:uuid:${meta.uuid}</dc:identifier>
    <meta refines="#book-uuid" property="identifier-type" scheme="xsd:string">uuid</meta>
    <dc:title>${xmlEscape(meta.title)}</dc:title>
    <dc:creator id="author">${xmlEscape(meta.author)}</dc:creator>
    <meta refines="#author" property="role" scheme="marc:relators">aut</meta>
    <dc:description>${xmlEscape(meta.description)}</dc:description>
    <dc:publisher>${xmlEscape(meta.publisher)}</dc:publisher>
    <dc:language>${meta.language}</dc:language>
    <dc:subject>${xmlEscape(meta.genre)}</dc:subject>
    <meta property="dcterms:modified">${meta.dateModified}T00:00:00Z</meta>${coverMeta}
  </metadata>
  <manifest>
    <item id="ncx"        href="toc.ncx"       media-type="application/x-dtbncx+xml"/>
    <item id="nav"        href="nav.xhtml"      media-type="application/xhtml+xml" properties="nav"/>
    <item id="stylesheet" href="stylesheet.css" media-type="text/css"/>
    <item id="cover-page" href="cover.xhtml"   media-type="application/xhtml+xml"/>
${coverManifest}
${manifestItems}
  </manifest>
  <spine toc="ncx">
    ${coverSpine}
${spineItems}
  </spine>
</package>`;
}

function buildNcx(meta: EpubMeta, chapters: ParsedChapter[]): string {
  const navPoints = chapters.map((ch, i) => `  <navPoint id="np-${i + 1}" playOrder="${i + 2}">
    <navLabel><text>${xmlEscape(ch.title)}</text></navLabel>
    <content src="${ch.filename}"/>
  </navPoint>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${meta.uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${xmlEscape(meta.title)}</text></docTitle>
  <navMap>
  <navPoint id="np-cover" playOrder="1">
    <navLabel><text>Cover</text></navLabel>
    <content src="cover.xhtml"/>
  </navPoint>
${navPoints}
  </navMap>
</ncx>`;
}

function buildNavXhtml(meta: EpubMeta, chapters: ParsedChapter[]): string {
  const tocItems = chapters.map(ch =>
    `      <li><a href="${ch.filename}">${xmlEscape(ch.title)}</a></li>`
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="cover.xhtml">Cover</a></li>
${tocItems}
    </ol>
  </nav>
</body>
</html>`;
}

// ─── Cover image fetching ────────────────────────────────────────────────────

async function fetchCoverBuffer(coverUrl: string | null | undefined): Promise<Buffer | null> {
  if (!coverUrl) return null;

  // Try local filesystem first
  const localPath = path.join(process.cwd(), coverUrl.replace(/^\//, "").replace(/^objstore\//, "uploads/covers/"));
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }

  // Try the app URL (for objstore paths served via /objstore/...)
  try {
    const baseUrl = process.env.REPL_DEV_DOMAIN
      ? `https://${process.env.REPL_DEV_DOMAIN}`
      : "http://localhost:5000";
    const urlPath = coverUrl.startsWith("http")
      ? coverUrl
      : `${baseUrl}${coverUrl.startsWith("/") ? "" : "/"}${coverUrl}`;
    const res = await fetch(urlPath, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    }
  } catch {
    // fall through — cover just won't be embedded
  }

  return null;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateDistributionEpub(draftId: number): Promise<Buffer> {
  // Fetch draft
  const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!draft) throw new Error(`Draft ${draftId} not found`);

  // Try to get the published book's author (title match)
  let authorName = "EbookGamez";
  try {
    const [pub] = await db.select({ author: books.author })
      .from(books)
      .where(eq(books.title, draft.title));
    if (pub?.author) authorName = pub.author;
  } catch {}

  const title = draft.title || "Untitled";
  const description = draft.description || `A ${draft.genre} ebook by ${authorName}.`;
  const genre = draft.genre || "Fiction";
  const content = draft.content || draft.outline || "";

  const meta: EpubMeta = {
    uuid: crypto.randomUUID(),
    title,
    author: authorName,
    description,
    publisher: "EbookGamez",
    language: "en",
    genre,
    dateModified: new Date().toISOString().slice(0, 10),
  };

  // Parse content into chapters
  const chapters = parseChapters(content);

  // Fetch cover image
  const coverUrl = draft.coverUrl || draft.backgroundUrl;
  const coverBuffer = await fetchCoverBuffer(coverUrl);
  const hasCover = coverBuffer !== null;

  // ── Build ZIP ──
  const zip = new JSZip();

  // mimetype — MUST be first and uncompressed (STORE)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // META-INF
  zip.folder("META-INF")!.file("container.xml", buildContainerXml());

  // OEBPS root
  const oebps = zip.folder("OEBPS")!;
  oebps.file("content.opf", buildContentOpf(meta, chapters, hasCover));
  oebps.file("toc.ncx", buildNcx(meta, chapters));
  oebps.file("nav.xhtml", buildNavXhtml(meta, chapters));
  oebps.file("stylesheet.css", buildStylesheet());
  oebps.file("cover.xhtml", buildCoverXhtml(hasCover, title));

  // Cover image
  if (hasCover && coverBuffer) {
    oebps.folder("images")!.file("cover.jpg", coverBuffer);
  }

  // Chapters
  const chaptersFolder = oebps.folder("chapters")!;
  for (const ch of chapters) {
    chaptersFolder.file(`${ch.id}.xhtml`, ch.xhtml);
  }

  // Generate ZIP buffer
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return buffer;
}
