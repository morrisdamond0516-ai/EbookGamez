/**
 * Generate and persist character visual bibles for illustrated fiction.
 */
import OpenAI from "openai";
import { db } from "./storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  type CharacterVisualBible,
  type CharacterVisualProfile,
  parseCharacterBibleFromDescription,
  withCharacterBibleInDescription,
  formatCharacterBibleForImagePrompt,
} from "@shared/characterBible";

const openaiChat = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export {
  parseCharacterBibleFromDescription,
  withCharacterBibleInDescription,
  formatCharacterBibleForImagePrompt,
  formatCharacterBibleForChapterWriting,
  formatCharacterBibleForMarkerInjection,
  charactersForIllustrationMarker,
} from "@shared/characterBible";

export async function generateCharacterVisualBible(options: {
  title: string;
  genre: string;
  outline: string;
  coverAnalysis?: string;
  creativeDirection?: string;
  existingContentSample?: string;
}): Promise<CharacterVisualBible> {
  const { title, genre, outline, coverAnalysis, creativeDirection, existingContentSample } = options;

  const response = await openaiChat.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a children's book art director creating a CHARACTER VISUAL BIBLE for consistent illustrations.

Output JSON only:
{
  "characters": [
    {
      "name": "Character name from the outline",
      "role": "protagonist | supporting | antagonist",
      "isProtagonist": true,
      "fixedAppearance": "One sentence: age, face shape, skin tone, eye color, hair color/style/length — NEVER changes between scenes",
      "defaultOutfit": "Default clothes worn for most of the story",
      "signatureItems": ["items always visible, e.g. brass goggles"],
      "outfitVariants": [
        { "label": "short label", "whenToUse": "Only in ch.3 rain scene / only at the ball", "outfitDescription": "specific alternate outfit" }
      ],
      "doNotChange": ["face", "hair color", "eye color", "signature items unless story says removed"]
    }
  ],
  "globalRules": [
    "Same character = same face and hair in every illustration",
    "Change clothes ONLY when scene matches a listed outfitVariant",
    "Background characters may vary; recurring named characters must match the bible"
  ],
  "artStyleNote": "optional note aligning characters with cover art"
}

Rules:
- Include every RECURRING named character from the outline (especially the protagonist).
- fixedAppearance must be specific enough that an illustrator could draw the same face twice.
- outfitVariants: only list real story moments where clothes SHOULD change. Most characters need 0-2 variants.
- If cover analysis describes the protagonist's look, use it as the source of truth for fixedAppearance.`,
      },
      {
        role: "user",
        content: [
          `Book: "${title}" (${genre})`,
          creativeDirection ? `\nCreative direction:\n${creativeDirection.slice(0, 3000)}` : "",
          `\nOutline:\n${outline.slice(0, 12000)}`,
          coverAnalysis ? `\nCover visual analysis:\n${coverAnalysis.slice(0, 4000)}` : "",
          existingContentSample
            ? `\nStory excerpt (use for character names and any appearance details already in prose):\n${existingContentSample.slice(0, 6000)}`
            : "",
        ].join("\n"),
      },
    ],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw) as {
    characters?: CharacterVisualProfile[];
    globalRules?: string[];
    artStyleNote?: string;
  };

  const characters = (parsed.characters ?? []).filter((c) => c?.name && c?.fixedAppearance);
  if (characters.length === 0) {
    throw new Error("Character bible generation returned no characters");
  }

  if (!characters.some((c) => c.isProtagonist)) {
    characters[0].isProtagonist = true;
  }

  return {
    generatedAt: new Date().toISOString(),
    bookTitle: title,
    genre,
    artStyleNote: parsed.artStyleNote,
    characters,
    globalRules: parsed.globalRules?.length
      ? parsed.globalRules
      : [
          "Recurring characters must have identical faces, hair, and skin tone in every illustration.",
          "Change clothing only when the scene matches a defined outfit variant.",
        ],
  };
}

export async function buildAndSaveCharacterBibleForDraft(
  draftId: number,
  options?: { force?: boolean; contentSample?: boolean },
): Promise<CharacterVisualBible> {
  const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!draft) throw new Error(`Draft ${draftId} not found`);

  if (!options?.force && parseCharacterBibleFromDescription(draft.description)) {
    return parseCharacterBibleFromDescription(draft.description)!;
  }

  if (!draft.outline?.trim()) {
    throw new Error(`Draft ${draftId} has no outline — generate outline first`);
  }

  const bible = await generateCharacterVisualBible({
    title: draft.title || "Untitled",
    genre: draft.genre || "General",
    outline: draft.outline,
    coverAnalysis: undefined,
    creativeDirection: draft.topic,
    existingContentSample:
      options?.contentSample && draft.content ? draft.content.slice(0, 12000) : undefined,
  });

  await db
    .update(draftEbooks)
    .set({ description: withCharacterBibleInDescription(draft.description, bible) })
    .where(eq(draftEbooks.id, draftId));

  console.log(
    `[Character Bible] Saved for #${draftId} "${draft.title}" — ${bible.characters.map((c) => c.name).join(", ")}`,
  );
  return bible;
}

export function enrichImagePromptWithCharacterBible(
  imagePrompt: string,
  bible: CharacterVisualBible | null | undefined,
  markerDescription: string,
): string {
  if (!bible) return imagePrompt;
  const lock = formatCharacterBibleForImagePrompt(bible, markerDescription);
  if (!lock) return imagePrompt;
  return `${lock}\n\nSCENE TO ILLUSTRATE:\n${imagePrompt}`;
}

export async function getCharacterBibleForDraftId(draftId: number): Promise<CharacterVisualBible | null> {
  const [row] = await db
    .select({ description: draftEbooks.description })
    .from(draftEbooks)
    .where(eq(draftEbooks.id, draftId));
  return parseCharacterBibleFromDescription(row?.description);
}
