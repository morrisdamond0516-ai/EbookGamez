import { describe, it, expect } from "vitest";
import { parseOutlineIllustrationSlots } from "../shared/outlineIllustrations";

describe("parseOutlineIllustrationSlots", () => {
  it("parses # **Chapter N** educational outlines with body markers (not /m $ EOL trap)", () => {
    const outline = `# **Book Title**
# **Chapter 1 — Welcome**
## Learning Objectives
- Learn print concepts
[ILLUSTRATION: Classroom print concepts poster with left-to-right arrows]
## Practice
More text here.

# **Chapter 2 — Letters**
Intro text.
[ILLUSTRATION: Alphabet chart with uppercase and lowercase pairs]
[ILLUSTRATION: Handwriting formation strokes for letter A]
`;
    const slots = parseOutlineIllustrationSlots(outline);
    expect(slots.filter((s) => s.chapterNum === 1)).toHaveLength(1);
    expect(slots.filter((s) => s.chapterNum === 2)).toHaveLength(2);
    expect(slots.every((s) => s.chapterNum > 0)).toBe(true);
  });
});
