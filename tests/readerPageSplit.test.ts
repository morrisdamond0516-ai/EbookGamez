import { describe, expect, it } from "vitest";
import {
  splitIntoPages,
  isUnderfilledPage,
  mergeUnderfilledPages,
  densifySchoolbookPages,
  densifyProsePages,
  MIN_PAGE_TEXT_WORDS,
  MAX_VISUAL_LINES,
  NOVEL_BOTTOM_SLACK_LINES,
  pageVisualLines,
} from "../shared/readerPageSplit";

describe("readerPageSplit underfilled pages", () => {
  it("merges a one-sentence page into the following page when height allows", () => {
    const text = [
      "This is a complete instructional paragraph that explains the concept clearly for the student and parent.",
      "",
      "Short leftover.",
      "",
      "Here comes another full teaching paragraph with enough words to fill meaningful space on the shared page after the merge.",
      "It continues with a second sentence so the page has real density.",
    ].join("\n");

    const pages = splitIntoPages(text, 0, { smallIllustrations: true, mergeUnderfilled: true });
    const thin = pages.filter((p) => isUnderfilledPage(p, true, MAX_VISUAL_LINES));
    expect(thin.length).toBe(0);
    expect(pages.some((p) => p.join(" ").includes("Short leftover."))).toBe(true);
  });

  it("keeps figure + following lesson text on the same schoolbook page when it fits", () => {
    const text = [
      "[ILLUSTRATION: /uploads/illustrations/demo.png | Sample diagram]",
      "",
      "Count the sides on each shape.",
    ].join("\n");
    const pages = splitIntoPages(text, 0, { smallIllustrations: true, mergeUnderfilled: true });
    expect(pages.length).toBe(1);
    expect(pages[0].some((l) => l.includes("ILLUSTRATION"))).toBe(true);
    expect(pages[0].some((l) => l.includes("Count the sides"))).toBe(true);
  });

  it("lets kid-size figures dominate the page (overflow text continues next)", () => {
    const text = [
      "[ILLUSTRATION: /uploads/illustrations/demo.png | Sample diagram]",
      "",
      "Grade 1 students learn that reading is a skill built with tools, not a talent you either have or do not have.",
      "Practice routines make progress visible each week for every student in the classroom.",
    ].join("\n");
    const pages = splitIntoPages(text, 0, { smallIllustrations: true, mergeUnderfilled: true });
    const figPage = pages.find((p) => p.some((l) => l.includes("ILLUSTRATION")));
    expect(figPage).toBeDefined();
    expect(pageVisualLines(figPage!, true)).toBeGreaterThan(18);
    expect(pages.some((p) => p.some((l) => l.includes("Grade 1") || l.includes("Practice")))).toBe(true);
  });

  it("scanUnderfilledReaderPages reports fewer thin pages after schoolbook merge", () => {
    const chunks: string[] = [];
    for (let i = 0; i < 6; i++) {
      chunks.push(`[ILLUSTRATION: /uploads/illustrations/x${i}.png | fig]`);
      chunks.push("");
      chunks.push(`Only sentence ${i}.`);
      chunks.push("");
    }
    const withoutMerge = splitIntoPages(chunks.join("\n"), 0, {
      smallIllustrations: false,
      mergeUnderfilled: false,
    });
    expect(withoutMerge.some((p) => isUnderfilledPage(p, false, MAX_VISUAL_LINES))).toBe(true);

    const withMerge = splitIntoPages(chunks.join("\n"), 0, {
      smallIllustrations: true,
      mergeUnderfilled: true,
    });
    const stillThin = withMerge.filter((p) => isUnderfilledPage(p, true, MAX_VISUAL_LINES));
    expect(stillThin.length).toBeLessThan(
      withoutMerge.filter((p) => isUnderfilledPage(p, false, MAX_VISUAL_LINES)).length,
    );
  });

  it("mergeUnderfilledPages combines adjacent thin pages", () => {
    const pages = [["Only one short sentence here."], ["Another short sentence follows next."]];
    const merged = mergeUnderfilledPages(pages, true, MAX_VISUAL_LINES);
    expect(merged.length).toBe(1);
    expect(merged[0].join(" ")).toContain("Only one short");
    expect(MIN_PAGE_TEXT_WORDS).toBeGreaterThan(20);
  });

  it("densifySchoolbookPages pulls following text onto a half-filled page", () => {
    const pages = [
      [
        "You just learned how to sort shapes by sides.",
        "Keep that rule in mind while you look at the next figure.",
      ],
      [
        "Now count the sides on each shape and write the total on the line.",
        "Check your answers with a partner when you finish.",
        "If one shape was hard, circle it and try again tomorrow.",
      ],
    ];
    const before = pageVisualLines(pages[0], true);
    const densified = densifySchoolbookPages(pages, true, MAX_VISUAL_LINES);
    expect(pageVisualLines(densified[0], true)).toBeGreaterThan(before);
    expect(densified[0].join(" ")).toContain("count the sides");
  });

  it("never packs schoolbook pages past max visual lines", () => {
    const filler = Array.from({ length: 12 }, (_, i) =>
      `Paragraph ${i + 1} explains a concept with enough words to fill several reader lines toward the bottom of the fixed flipbook page.`,
    ).join("\n\n");
    const text = [
      "[ILLUSTRATION: /uploads/illustrations/a.png | A]",
      "Short note after the first figure for grade 2 readers.",
      "[ILLUSTRATION: /uploads/illustrations/b.png | B]",
      filler,
      "## Practice",
      "Try this practice item with a partner today.",
      "Write one sentence about fairness on the line.",
    ].join("\n\n");
    const pages = splitIntoPages(text, 0, { smallIllustrations: true, mergeUnderfilled: true });
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(pageVisualLines(page, true)).toBeLessThanOrEqual(MAX_VISUAL_LINES + 0.51);
    }
  });

  it("densifyProsePages pulls following prose onto a half-filled novel page", () => {
    const pages = [
      [
        "The rain had stopped by the time she reached the station, but the platform was still slick with reflections.",
      ],
      [
        "She checked the timetable twice before noticing the stranger watching from the far end of the platform.",
        "When their eyes met, he looked away as if he had never been there at all.",
        "The train arrived with a hiss of brakes and a cloud of steam that smelled like wet wool.",
      ],
    ];
    const before = pageVisualLines(pages[0], false);
    const densified = densifyProsePages(pages, MAX_VISUAL_LINES);
    expect(pageVisualLines(densified[0], false)).toBeGreaterThan(before);
    expect(densified[0].join(" ")).toContain("stranger watching");
  });

  it("splits long novel paragraphs across pages without clipping", () => {
    const paragraph =
      "She walked through the market at dawn, past stalls of oranges and bread still warm from the oven, " +
      "past fishermen mending nets and children chasing each other between the carts, " +
      "until she reached the corner where the old bookshop stood with its green door and faded sign.";
    const text = Array.from({ length: 8 }, () => paragraph).join("\n\n");
    const pages = splitIntoPages(text, 0, { smallIllustrations: false, mergeUnderfilled: true });
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(pageVisualLines(page, false)).toBeLessThanOrEqual(MAX_VISUAL_LINES + 0.51);
    }
    const slackTarget = MAX_VISUAL_LINES - NOVEL_BOTTOM_SLACK_LINES;
    const midPages = pages.slice(0, -1);
    expect(midPages.some((p) => pageVisualLines(p, false) >= slackTarget - 1)).toBe(true);
  });

  it("keeps Example / Practice headers with at least one follower (two when available)", () => {
    const filler = Array.from({ length: 18 }, (_, i) =>
      `Paragraph ${i + 1} explains a concept with enough words to fill the page gradually toward the bottom edge of the reader.`,
    ).join("\n\n");
    const text = [
      filler,
      "",
      "## Worked Example",
      "",
      "First example step: blend the sounds in the word.",
      "Second example step: write the word with correct spelling.",
      "",
      "## Practice",
      "",
      "Try reading these three words aloud.",
    ].join("\n");
    const pages = splitIntoPages(text, 0, { smallIllustrations: true, mergeUnderfilled: true });
    for (const page of pages) {
      const lines = page.map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        if (/^##\s*Worked Example/i.test(lines[i]) || /^##\s*Practice/i.test(lines[i])) {
          const rest = lines.slice(i + 1);
          expect(rest.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
