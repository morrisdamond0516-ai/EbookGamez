import { describe, it, expect } from "vitest";
import {
  parseCharacterBibleFromDescription,
  withCharacterBibleInDescription,
  stripCharacterBibleFromDescription,
  formatCharacterBibleForImagePrompt,
  charactersForIllustrationMarker,
  type CharacterVisualBible,
} from "../shared/characterBible";

const sampleBible: CharacterVisualBible = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  bookTitle: "The Clockwork Forest",
  genre: "Children's Fiction",
  characters: [
    {
      name: "Juni",
      role: "protagonist",
      isProtagonist: true,
      fixedAppearance: "10-year-old girl, round face, warm brown skin, curly black hair in a puff, large amber eyes",
      defaultOutfit: "green linen overalls, cream shirt, brass goggles on forehead",
      signatureItems: ["brass goggles", "leather tool belt"],
      outfitVariants: [
        {
          label: "rain",
          whenToUse: "Chapter 4 forest storm",
          outfitDescription: "same overalls with yellow rain slicker",
        },
      ],
      doNotChange: ["hair", "eye color", "goggles"],
    },
  ],
  globalRules: ["Same face every scene"],
};

describe("characterBible", () => {
  it("round-trips in description", () => {
    const desc = withCharacterBibleInDescription("Catalog blurb here.", sampleBible);
    expect(parseCharacterBibleFromDescription(desc)?.characters[0].name).toBe("Juni");
    expect(stripCharacterBibleFromDescription(desc)).toBe("Catalog blurb here.");
  });

  it("matches character by name in marker", () => {
    const found = charactersForIllustrationMarker(sampleBible, "Juni examines a clockwork bird");
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe("Juni");
  });

  it("includes protagonist for generic person cues", () => {
    const found = charactersForIllustrationMarker(sampleBible, "The girl winds the brass mechanism");
    expect(found[0]?.name).toBe("Juni");
  });

  it("injects visual lock into image prompt", () => {
    const prompt = formatCharacterBibleForImagePrompt(sampleBible, "Juni smiles at the forest");
    expect(prompt).toContain("CHARACTER VISUAL LOCK");
    expect(prompt).toContain("curly black hair");
    expect(prompt).toContain("green linen overalls");
  });
});
