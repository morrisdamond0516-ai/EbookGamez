/**
 * Character visual bible — stored in draft.description (hidden from catalog).
 * Locks recurring character face/hair/outfit across illustrations; allows
 * explicit outfit variants only when the story context calls for a change.
 */
export type CharacterOutfitVariant = {
  label: string;
  whenToUse: string;
  outfitDescription: string;
};

export type CharacterVisualProfile = {
  name: string;
  role: string;
  isProtagonist?: boolean;
  /** Face, hair, skin, eyes, age — identical in every scene unless variant applies */
  fixedAppearance: string;
  /** Starting/default outfit */
  defaultOutfit: string;
  signatureItems: string[];
  /** Only use these looks in the listed story contexts — never invent new outfits */
  outfitVariants?: CharacterOutfitVariant[];
  doNotChange: string[];
};

export type CharacterVisualBible = {
  generatedAt: string;
  bookTitle: string;
  genre: string;
  artStyleNote?: string;
  characters: CharacterVisualProfile[];
  globalRules: string[];
};

const BLOCK_START = "---CHARACTER_VISUAL_BIBLE---";
const BLOCK_END = "---END_CHARACTER_VISUAL_BIBLE---";

export function parseCharacterBibleFromDescription(
  description: string | null | undefined,
): CharacterVisualBible | null {
  if (!description) return null;
  const match = description.match(
    new RegExp(`${BLOCK_START}\\s*([\\s\\S]*?)\\s*${BLOCK_END}`),
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as CharacterVisualBible;
    if (parsed?.characters?.length) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function stripCharacterBibleFromDescription(description: string | null | undefined): string {
  if (!description) return "";
  return description
    .replace(new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\\s*`, "g"), "")
    .trim();
}

export function withCharacterBibleInDescription(
  description: string | null | undefined,
  bible: CharacterVisualBible,
): string {
  const base = stripCharacterBibleFromDescription(description);
  const block = `${BLOCK_START}\n${JSON.stringify(bible)}\n${BLOCK_END}`;
  return base ? `${base}\n\n${block}` : block;
}

function nameInText(name: string, text: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

/** Characters referenced in a marker description (by name or protagonist fallback). */
export function charactersForIllustrationMarker(
  bible: CharacterVisualBible,
  markerDescription: string,
): CharacterVisualProfile[] {
  const text = markerDescription.toLowerCase();
  const byName = bible.characters.filter((c) => nameInText(c.name, markerDescription));

  if (byName.length > 0) return byName;

  const personCue =
    /\b(she|he|they|girl|boy|child|kid|woman|man|protagonist|character|hero|heroine)\b/i.test(
      markerDescription,
    );
  if (personCue) {
    const lead = bible.characters.find((c) => c.isProtagonist) ?? bible.characters[0];
    if (lead) return [lead];
  }

  return [];
}

function formatProfileBlock(c: CharacterVisualProfile, sceneContext: string): string {
  let outfit = c.defaultOutfit;
  for (const v of c.outfitVariants ?? []) {
    if (
      nameInText(v.label, sceneContext) ||
      nameInText(v.whenToUse, sceneContext) ||
      sceneContext.toLowerCase().includes(v.whenToUse.toLowerCase().slice(0, 24))
    ) {
      outfit = v.outfitDescription;
      break;
    }
  }

  return [
    `${c.name} (${c.role})`,
    `FACE & BODY (never change): ${c.fixedAppearance}`,
    `OUTFIT THIS SCENE: ${outfit}`,
    c.signatureItems.length ? `ALWAYS INCLUDE: ${c.signatureItems.join(", ")}` : "",
    c.doNotChange.length ? `DO NOT CHANGE: ${c.doNotChange.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Prompt block for image generation — only characters in this scene. */
export function formatCharacterBibleForImagePrompt(
  bible: CharacterVisualBible,
  markerDescription: string,
): string {
  const chars = charactersForIllustrationMarker(bible, markerDescription);
  if (chars.length === 0) return "";

  const blocks = chars.map((c) => formatProfileBlock(c, markerDescription));
  const rules = bible.globalRules.length
    ? `\nGLOBAL CHARACTER RULES:\n${bible.globalRules.map((r) => `- ${r}`).join("\n")}`
    : "";

  return (
    `CHARACTER VISUAL LOCK — recurring characters MUST match exactly across every illustration in this book. ` +
    `Do NOT change face shape, eye color, hair, skin tone, or signature items unless an outfit variant is listed for this scene. ` +
    `Only change clothes when the scene description explicitly matches a listed outfit variant.\n\n` +
    blocks.join("\n\n") +
    rules
  );
}

/** Chapter-writing instructions — prose and [ILLUSTRATION:] markers must follow the bible. */
export function formatCharacterBibleForChapterWriting(bible: CharacterVisualBible): string {
  const charBlocks = bible.characters
    .map((c) => {
      const variants =
        c.outfitVariants?.length
          ? `\n  Outfit changes ONLY in these contexts:\n${c.outfitVariants
              .map((v) => `    - ${v.whenToUse}: ${v.outfitDescription}`)
              .join("\n")}`
          : "\n  Outfit: stays in default unless a listed variant context applies.";
      return (
        `- ${c.name} (${c.role})${c.isProtagonist ? " [PROTAGONIST]" : ""}\n` +
        `  Fixed look: ${c.fixedAppearance}\n` +
        `  Default outfit: ${c.defaultOutfit}\n` +
        `  Signature items: ${c.signatureItems.join(", ") || "none"}\n` +
        `  Never change: ${c.doNotChange.join("; ")}` +
        variants
      );
    })
    .join("\n\n");

  return (
    `CHARACTER VISUAL BIBLE (binding for prose AND every [ILLUSTRATION: ...] marker):\n` +
    `When a named character appears in an illustration marker, paste their EXACT fixed look and correct outfit from below. ` +
    `Do NOT invent new hairstyles, faces, or clothing. Only use outfit variants in the listed story contexts.\n\n` +
    charBlocks +
    (bible.globalRules.length
      ? `\n\nGlobal rules:\n${bible.globalRules.map((r) => `- ${r}`).join("\n")}`
      : "")
  );
}

/** Marker-injection system prompt appendix. */
export function formatCharacterBibleForMarkerInjection(bible: CharacterVisualBible): string {
  return (
    `\n\nCHARACTER VISUAL BIBLE — every illustration description that includes a person MUST use these exact looks:\n` +
    bible.characters
      .map(
        (c) =>
          `${c.name}: ${c.fixedAppearance}. Default outfit: ${c.defaultOutfit}. ` +
          `Keep: ${[...c.signatureItems, ...c.doNotChange].join(", ")}.`,
      )
      .join("\n")
  );
}
