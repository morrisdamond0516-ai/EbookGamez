/**
 * Typography Effects Utility
 * Maps AI-generated effect names to CSS classes for rendering
 */

// Map effect names to CSS class names
export const effectToClass: Record<string, string> = {
  // Premium effects
  'metallic-gold': 'effect-metallic-gold',
  'metallic-silver': 'effect-metallic-silver',
  'metallic-copper': 'effect-metallic-copper',
  '3d-layered': 'effect-3d-layered',
  'embossed': 'effect-embossed',
  'debossed': 'effect-debossed',
  'neon-electric': 'effect-neon-electric',
  'fire-glow': 'effect-fire-glow',
  'ice-crystal': 'effect-ice-crystal',
  'cosmic-glow': 'effect-cosmic-glow',
  'duotone-gradient': 'effect-duotone-gradient',
  'smoke-emerge': 'effect-smoke-emerge',
  'frosted-glass': 'effect-frosted-glass',
  'luxury-shadow': 'effect-luxury-shadow',
  'split-tone': 'effect-split-tone',
  
  // Basic effects
  'elegant-glow': 'effect-elegant-glow',
  'gold-emboss': 'effect-gold-emboss',
  'sharp-shadow': 'effect-sharp-shadow',
  'bold-shadow': 'effect-bold-shadow',
  'subtle-outline': 'effect-subtle-outline',
  'neon-glow': 'effect-neon-glow',
  'vintage': 'effect-vintage',
  'emboss': 'effect-emboss',
  'outline': 'effect-outline',
  'neon': 'effect-neon',
  'glow': 'effect-glow',
  'shadow': 'effect-shadow',
  'elegant': 'effect-elegant',
  'none': 'effect-none',
};

// Map typographic mood to CSS class
export const moodToClass: Record<string, string> = {
  'ethereal dreamlike': 'mood-ethereal-dreamlike',
  'ethereal': 'mood-ethereal-dreamlike',
  'dreamlike': 'mood-ethereal-dreamlike',
  'raw powerful': 'mood-raw-powerful',
  'powerful': 'mood-raw-powerful',
  'raw': 'mood-raw-powerful',
  'epic cinematic': 'mood-epic-cinematic',
  'cinematic': 'mood-epic-cinematic',
  'epic': 'mood-epic-cinematic',
  'intimate whispered': 'mood-intimate-whispered',
  'whispered': 'mood-intimate-whispered',
  'intimate': 'mood-intimate-whispered',
  'opulent luxurious': 'mood-opulent-luxurious',
  'luxurious': 'mood-opulent-luxurious',
  'opulent': 'mood-opulent-luxurious',
};

// Get CSS class for an effect
export function getEffectClass(effect: string | undefined): string {
  if (!effect) return 'effect-elegant-glow';
  const normalized = effect.toLowerCase().trim();
  return effectToClass[normalized] || 'effect-elegant-glow';
}

// Get CSS class for a mood
export function getMoodClass(mood: string | undefined): string {
  if (!mood) return '';
  const normalized = mood.toLowerCase().trim();
  
  // Try exact match first
  if (moodToClass[normalized]) return moodToClass[normalized];
  
  // Try partial match
  for (const [key, value] of Object.entries(moodToClass)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  return '';
}

// Get inline style variables for colors
export function getColorVariables(
  titleColor?: string,
  titleSecondaryColor?: string
): React.CSSProperties {
  const style: React.CSSProperties = {};
  
  if (titleColor) {
    (style as any)['--title-color'] = titleColor;
  }
  if (titleSecondaryColor) {
    (style as any)['--title-secondary-color'] = titleSecondaryColor;
  }
  
  return style;
}

// Build complete class string for title
export function buildTitleClasses(
  effect?: string,
  mood?: string,
  additionalClasses?: string
): string {
  const classes: string[] = [];
  
  // Add effect class
  classes.push(getEffectClass(effect));
  
  // Add mood class if present
  const moodClass = getMoodClass(mood);
  if (moodClass) classes.push(moodClass);
  
  // Add additional classes
  if (additionalClasses) classes.push(additionalClasses);
  
  return classes.join(' ');
}

// Parse placement philosophy to get animation class
export function getPlacementAnimation(placementPhilosophy?: string): string {
  if (!placementPhilosophy) return '';
  
  const normalized = placementPhilosophy.toLowerCase();
  
  if (normalized.includes('emerge') || normalized.includes('darkness')) {
    return 'placement-emerge-from-darkness';
  }
  if (normalized.includes('float') || normalized.includes('breathing')) {
    return 'placement-floating';
  }
  
  return '';
}

// Export all effect names for UI dropdowns
export const availableEffects = Object.keys(effectToClass);

// Premium effects only (for special highlighting in UI)
export const premiumEffects = [
  'metallic-gold',
  'metallic-silver', 
  'metallic-copper',
  '3d-layered',
  'embossed',
  'debossed',
  'neon-electric',
  'fire-glow',
  'ice-crystal',
  'cosmic-glow',
  'duotone-gradient',
  'smoke-emerge',
  'frosted-glass',
  'luxury-shadow',
  'split-tone',
];

// Basic effects
export const basicEffects = [
  'elegant-glow',
  'gold-emboss',
  'sharp-shadow',
  'bold-shadow',
  'subtle-outline',
  'neon-glow',
  'vintage',
  'emboss',
  'outline',
  'neon',
  'glow',
  'shadow',
  'elegant',
  'none',
];
