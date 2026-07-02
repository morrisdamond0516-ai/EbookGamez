/**
 * PROTECTED COVER STYLE DEFINITIONS
 * 
 * This file contains the permanent style definitions for ebook covers.
 * The "Classic Cinematic" style (scenic imagery) is the PROTECTED PRIMARY DEFAULT
 * and should NEVER be changed without explicit permission.
 * 
 * These definitions are also backed up to cloud storage to survive rollbacks.
 */

export interface CoverStyleDefinition {
  id: string;
  name: string;
  description: string;
  isProtected: boolean;
  colorSchemes: string[];
  designStyles: string[];
  genreElements: Record<string, string[]>;
  promptTemplate: string;
}

// AI Model options for image generation
export interface AIModelStyle {
  id: string;
  name: string;
  description: string;
  model: "gpt-image-1" | "dall-e-3";
  previewImage: string; // Path to sample image
  characteristics: string[];
}

// Two main AI model styles
export const AI_MODEL_STYLES: AIModelStyle[] = [
  {
    id: "classic-library-239",
    name: "Classic Library 239",
    description: "EXACT original prompt that created covers 239-253. Dark academia, burgundy/gold, vintage library.",
    model: "gpt-image-1",
    previewImage: "/uploads/covers/style-preview-classic-239.png",
    characteristics: [
      "Dark academia aesthetic",
      "Rich burgundy, gold, dark brown",
      "Vintage library feel",
      "Sophisticated and premium"
    ]
  },
  {
    id: "replit-cinematic",
    name: "Replit Cinematic",
    description: "The original artistic style used for covers 239-253. Rich textures and classic cinematic feel.",
    model: "gpt-image-1",
    previewImage: "/uploads/covers/style-preview-replit.png",
    characteristics: [
      "Warm, rich color tones",
      "Classic cinematic composition",
      "Textured, painterly quality",
      "Vintage film aesthetic"
    ]
  },
  {
    id: "dalle3-vivid",
    name: "DALL-E 3 Vivid",
    description: "Modern AI generation with photorealistic detail and vivid, dramatic lighting.",
    model: "dall-e-3",
    previewImage: "/uploads/covers/style-preview-dalle3.png",
    characteristics: [
      "High-definition detail",
      "Photorealistic quality",
      "Vivid, saturated colors",
      "Modern artistic style"
    ]
  }
];

export function getAIModelById(modelId: string): AIModelStyle {
  return AI_MODEL_STYLES.find(m => m.id === modelId) || AI_MODEL_STYLES[0];
}

// The PROTECTED PRIMARY DEFAULT - Classic Cinematic (Scenic Imagery)
export const CLASSIC_CINEMATIC_STYLE: CoverStyleDefinition = {
  id: "classic-cinematic",
  name: "Classic Cinematic",
  description: "Professional cinematic artwork with scenic imagery, dramatic lighting, and elegant color palettes",
  isProtected: true,
  colorSchemes: [
    "deep burgundy, antique gold, and mahogany brown",
    "midnight blue, silver, and charcoal gray",
    "forest green, bronze, and cream",
    "royal purple, gold leaf, and black",
    "burnt orange, copper, and dark chocolate",
    "teal, rose gold, and ivory",
    "crimson red, black, and gold",
    "sage green, blush pink, and white",
    "navy blue, coral, and sand",
    "emerald green, pearl white, and gold"
  ],
  designStyles: [
    "dark academia aesthetic with vintage library feel",
    "photorealistic cinematic movie poster style",
    "moody atmospheric with dramatic lighting",
    "sophisticated marble and metallic textures",
    "elegant baroque inspired ornamental design"
  ],
  genreElements: {
    "Fantasy": ["majestic castle on misty mountain", "magical forest with ancient runes", "dragon flying over medieval village"],
    "Science Fiction": ["futuristic cityscape with flying vehicles", "astronaut looking at spaceship among stars", "alien planet landscape"],
    "Romance": ["couple walking through romantic garden at sunset", "lovers on sunset beach with golden light", "elegant couple dancing in ballroom"],
    "Horror": ["haunted Victorian mansion with ghostly figure", "misty graveyard at night", "mysterious shadow figure in doorway"],
    "Mystery": ["detective examining clues in dark study", "man in trench coat on foggy street", "shadowy figure in dark alley"],
    "Self-Help": ["person standing triumphant on mountain summit", "serene meditation scene at sunrise", "confident person walking through light"],
    "Business": ["modern executive overlooking city skyline", "team celebrating success around chart", "professional handshake in glass office"],
    "default": ["elegant scholar with feather quill in grand library", "antique bookshop with leather-bound volumes", "writer in cozy study with fireplace"]
  },
  promptTemplate: 'Professional cinematic artwork for a {genre} book. Style: {designStyle}. Color palette: {colorScheme}. Feature {selectedElement} as central imagery. Sophisticated, premium quality, artistic composition. Beautiful scenic artwork. CRITICAL: This is a BACKGROUND IMAGE ONLY. ABSOLUTELY NO TEXT, NO TITLE, NO LETTERS, NO WORDS, NO TYPOGRAPHY, NO WRITING of any kind anywhere in the image. Leave the top and bottom areas clear for text to be added later. Pure visual imagery only.'
};

// All available cover styles
export const COVER_STYLES: CoverStyleDefinition[] = [
  CLASSIC_CINEMATIC_STYLE,
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "Clean, minimalist design with bold typography focus",
    isProtected: false,
    colorSchemes: ["pure white and black", "soft gray and charcoal", "cream and dark brown"],
    designStyles: ["clean minimalist with bold geometric shapes", "modern Swiss design aesthetic", "abstract minimal composition"],
    genreElements: {
      "default": ["abstract geometric patterns", "clean gradient backgrounds", "subtle texture overlays"]
    },
    promptTemplate: 'Minimalist abstract artwork for a book cover background. Style: {designStyle}. Colors: {colorScheme}. Feature {selectedElement}. Clean, modern, sophisticated. CRITICAL: ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS. Pure visual imagery only - text will be added later.'
  },
  {
    id: "vintage-classic",
    name: "Vintage Classic",
    description: "Retro book cover aesthetic with aged paper textures",
    isProtected: false,
    colorSchemes: ["sepia, cream, and aged brown", "faded gold and antique ivory", "weathered parchment tones"],
    designStyles: ["vintage 1920s book illustration style", "antique leather-bound tome aesthetic", "classic Victorian era design"],
    genreElements: {
      "default": ["ornate vintage border frames", "aged paper texture with elegant flourishes", "classic heraldic design elements"]
    },
    promptTemplate: 'Vintage classic book cover artwork background. Style: {designStyle}. Colors: {colorScheme}. Feature {selectedElement}. Elegant, timeless, distinguished. CRITICAL: ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS. Pure visual imagery only - text will be added later.'
  }
];

// Function to get style by ID
export function getStyleById(styleId: string): CoverStyleDefinition {
  const style = COVER_STYLES.find(s => s.id === styleId);
  return style || CLASSIC_CINEMATIC_STYLE;
}

// Function to generate prompt using a style definition
export function generatePromptFromStyle(
  style: CoverStyleDefinition,
  title: string,
  genre: string,
  seed: number
): string {
  const colorScheme = style.colorSchemes[seed % style.colorSchemes.length];
  const designStyle = style.designStyles[(seed * 7) % style.designStyles.length];
  
  let genreKey = Object.keys(style.genreElements).find(key => 
    genre.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(genre.toLowerCase())
  ) || "default";
  const genreElements = style.genreElements[genreKey] || style.genreElements["default"];
  const selectedElement = genreElements[(seed * 11) % genreElements.length];

  return style.promptTemplate
    .replace("{title}", title)
    .replace("{genre}", genre)
    .replace("{designStyle}", designStyle)
    .replace("{colorScheme}", colorScheme)
    .replace("{selectedElement}", selectedElement);
}

// Export for backup purposes - this ensures style definitions survive rollbacks
export const STYLE_DEFINITIONS_VERSION = "1.0.0";
export const STYLE_DEFINITIONS_LAST_UPDATED = "2026-01-27";
