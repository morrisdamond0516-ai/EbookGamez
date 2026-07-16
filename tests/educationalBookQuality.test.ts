import { describe, expect, it } from "vitest";
import {
  isEducationalGenre,
  isEducationalDraft,
  isSchoolbooksCatalogDraft,
  scanEducationalPedagogySignals,
  getInstructionalSectionKind,
  isInstructionalSectionHeader,
  usesSchoolbookPageLayout,
  scanEmptyInstructionalSections,
  repairEmptyInstructionalSections,
} from "../shared/educationalBookQuality";

describe("educationalBookQuality", () => {
  it("detects Textbooks and Education / Learning genres", () => {
    expect(isEducationalGenre("Textbooks")).toBe(true);
    expect(isEducationalGenre("Education / Learning")).toBe(true);
    expect(isEducationalGenre("Fantasy")).toBe(false);
    expect(isEducationalGenre("Mystery / Thriller")).toBe(false);
  });

  it("detects schoolbooks catalog placers from description", () => {
    expect(isSchoolbooksCatalogDraft("[Schoolbooks Catalog · elementary] Kindergarten Math")).toBe(true);
    expect(isEducationalDraft({ genre: "General", description: "[Schoolbooks Catalog · trade] HVAC" })).toBe(true);
    expect(isEducationalDraft({ genre: "Romance", description: "A love story" })).toBe(false);
  });

  it("flags long educational content with no pedagogy signals", () => {
    const novelish = ("Once upon a time the hero walked through the dark forest alone. ").repeat(500);
    const scan = scanEducationalPedagogySignals(novelish);
    expect(scan.issues.length).toBeGreaterThan(0);
  });

  it("accepts content with instructional markers", () => {
    const text = `
## Chapter 1
Learning Objectives: count to 10.
Worked Example: 1, 2, 3.
Practice: write the numbers.
Check Your Understanding: what comes after 5?
`;
    const scan = scanEducationalPedagogySignals(text);
    expect(scan.pedagogySignalCount).toBeGreaterThan(0);
    expect(scan.issues).toEqual([]);
  });

  it("classifies instructional section headers for schoolbook page chrome", () => {
    expect(getInstructionalSectionKind("## Learning Objectives")).toBe("objectives");
    expect(getInstructionalSectionKind("**Practice**")).toBe("practice");
    expect(getInstructionalSectionKind("Check Your Understanding")).toBe("check");
    expect(getInstructionalSectionKind("Key Terms")).toBe("keyterms");
    expect(isInstructionalSectionHeader("Once upon a time")).toBe(false);
    expect(
      getInstructionalSectionKind("**Remember:** You are not guessing. You are using map evidence."),
    ).toBe(null);
    expect(usesSchoolbookPageLayout("Textbooks")).toBe(true);
    expect(usesSchoolbookPageLayout("Fantasy")).toBe(false);
  });

  it("detects and repairs empty duplicate Practice/Example chrome shells", () => {
    const raw = [
      "## Chapter 1",
      "",
      "## Worked Example",
      "",
      "### Worked Example: Adding apples",
      "",
      "Show 2 + 3 = 5.",
      "",
      "## Practice",
      "",
      "### Practice A: Try these",
      "",
      "1) 1 + 1 = ___",
      "",
      "## Practice",
      "",
      "## Check Your Understanding",
      "",
      "What is 2 + 2?",
    ].join("\n");

    const scan = scanEmptyInstructionalSections(raw);
    expect(scan.details.some((d) => d.reason === "duplicate-shell")).toBe(true);
    expect(scan.issues.length).toBeGreaterThan(0);

    const repaired = repairEmptyInstructionalSections(raw);
    expect(repaired.removed).toBeGreaterThanOrEqual(2);
    expect(repaired.content).not.toMatch(/^## Worked Example$/m);
    expect(repaired.content).toMatch(/### Worked Example: Adding apples/);
    expect(repaired.content).toMatch(/### Practice A: Try these/);
    const after = scanEmptyInstructionalSections(repaired.content);
    expect(after.details.filter((d) => d.reason === "duplicate-shell").length).toBe(0);
  });

  it("flags peer empty numbered examples but does not strip their titles", () => {
    const raw = [
      "## Worked Example 5: Compare 356 and 365",
      "",
      "## Worked Example 7: Order 248, 284, 428",
      "",
      "Compare the hundreds place first.",
    ].join("\n");
    const scan = scanEmptyInstructionalSections(raw);
    expect(scan.details.some((d) => d.reason === "empty-body" && /Example 5/.test(d.heading))).toBe(true);
    expect(scan.details.some((d) => d.reason === "duplicate-shell")).toBe(false);
    const repaired = repairEmptyInstructionalSections(raw);
    expect(repaired.removed).toBe(0);
    expect(repaired.content).toMatch(/Worked Example 5/);
  });
});
