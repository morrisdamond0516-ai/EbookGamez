/**
 * Visual Intelligence System
 * Combines CoverImageAnalyzer + TitleComplexityDecider for intelligent title styling
 * Analyzes actual cover pixels to decide colors, placement, and complexity
 */

import { CoverImageAnalyzer, type CoverAnalysis } from './cover-image-analyzer';
import { TitleComplexityDecider, type ComplexityDecision, type TitleStyle } from './title-complexity-decider';
import { 
  recommendEffects, 
  getAlternativeEffect, 
  shouldEmphasizeFirstLetter,
  generateTwoToneStyle,
  generateCurvedPositions,
  generateStaggeredPositions,
  generateArtisticPositions,
  type TypographyEffect,
  type TwoToneStyle,
  type WordPosition
} from './effects-library';

export interface VisualIntelligenceResult {
  coverAnalysis: CoverAnalysis;
  complexityDecision: ComplexityDecision;
  titleStyle: TitleStyle;
  aiPromptEnhancements: string;
  cssVariables: Record<string, string>;
}

export interface TypographyEnhancement {
  titleColor: string;
  titleSecondaryColor: string;
  authorColor: string;
  titlePosition: 'top' | 'center' | 'bottom';
  titleAlignment: string;
  recommendedEffect: string;
  recommendedFont: string;
  complexityLevel: string;
  shouldUseUnique: boolean;
  perWordColors: string[] | null;
  perWordSizes: number[];
  visualAnalysisPrompt: string;
  // New enhancements from effects library
  recommendedEffects: TypographyEffect[];
  twoToneStyle: TwoToneStyle | null;
  firstLetterEmphasis: boolean;
  layoutType: 'linear' | 'curved' | 'staggered' | 'artistic';
  wordPositions: WordPosition[] | null;
}

const coverAnalyzer = new CoverImageAnalyzer();
const complexityDecider = new TitleComplexityDecider();

export async function analyzeForTypography(
  imageUrl: string,
  title: string,
  genre: string,
  description: string = ''
): Promise<VisualIntelligenceResult> {
  const coverAnalysis = await coverAnalyzer.analyzeCover(imageUrl, title, genre);
  
  const complexityDecision = complexityDecider.analyzeAndDecide(
    coverAnalysis,
    title,
    genre,
    coverAnalysis.mood,
    description
  );
  
  const titleStyle = complexityDecider.generateTitleStyle(
    complexityDecision,
    coverAnalysis,
    title,
    genre
  );
  
  const aiPromptEnhancements = generateAIPromptEnhancements(coverAnalysis, complexityDecision);
  
  const cssVariables = generateCSSVariables(coverAnalysis, titleStyle);
  
  return {
    coverAnalysis,
    complexityDecision,
    titleStyle,
    aiPromptEnhancements,
    cssVariables
  };
}

export function enhanceTypographyOptions(
  result: VisualIntelligenceResult,
  title: string = '',
  genre: string = ''
): TypographyEnhancement {
  const { coverAnalysis, complexityDecision, titleStyle } = result;
  
  const effectMap: Record<string, string> = {
    'subtle': 'elegant-shadow',
    'moderate': 'metallic-gold',
    'premium': 'cosmic-glow',
    'extreme': 'fire-glow'
  };
  
  const fontMap: Record<string, string> = {
    'cinematic': 'Cinzel',
    'painterly': 'Playfair Display',
    'minimal': 'Montserrat',
    'photographic': 'Raleway',
    'abstract': 'Great Vibes'
  };
  
  // Get recommended effects from the effects library
  const recommendedEffects = recommendEffects(
    genre || 'fiction',
    coverAnalysis.mood,
    complexityDecision.complexityLevel === 'minimal' ? 'simple' : 
      complexityDecision.complexityLevel === 'extreme' ? 'complex' : 
      complexityDecision.complexityLevel as 'simple' | 'moderate' | 'complex',
    5
  );
  
  // Check if first letter emphasis is appropriate
  const firstLetterEmphasis = title ? shouldEmphasizeFirstLetter(title) : false;
  
  // Generate two-tone style for moderate/complex titles
  let twoToneStyle: TwoToneStyle | null = null;
  if (complexityDecision.complexityLevel !== 'minimal' && coverAnalysis.optimalColors.primary && coverAnalysis.optimalColors.secondary) {
    twoToneStyle = generateTwoToneStyle(
      coverAnalysis.optimalColors.primary,
      coverAnalysis.optimalColors.secondary,
      complexityDecision.complexityLevel === 'complex' || complexityDecision.complexityLevel === 'extreme' ? 'diagonal' : 'vertical'
    );
  }
  
  // Determine layout type and generate word positions
  let layoutType: 'linear' | 'curved' | 'staggered' | 'artistic' = 'linear';
  let wordPositions: WordPosition[] | null = null;
  
  if (title && complexityDecision.shouldUseUnique) {
    const words = title.split(' ');
    
    if (complexityDecision.complexityLevel === 'extreme') {
      layoutType = 'artistic';
      wordPositions = generateArtisticPositions(words);
    } else if (complexityDecision.complexityLevel === 'complex') {
      layoutType = 'curved';
      wordPositions = generateCurvedPositions(words);
    } else if (complexityDecision.complexityLevel === 'moderate') {
      layoutType = 'staggered';
      wordPositions = generateStaggeredPositions(words);
    }
  }
  
  return {
    titleColor: coverAnalysis.optimalColors.primary,
    titleSecondaryColor: coverAnalysis.optimalColors.secondary,
    authorColor: coverAnalysis.optimalColors.accent,
    titlePosition: coverAnalysis.optimalPlacement.position,
    titleAlignment: titleStyle.layout.alignment,
    recommendedEffect: effectMap[titleStyle.styleCategory.effectsLevel] || 'elegant-shadow',
    recommendedFont: fontMap[coverAnalysis.imageStyle] || 'Playfair Display',
    complexityLevel: complexityDecision.complexityLevel,
    shouldUseUnique: complexityDecision.shouldUseUnique,
    perWordColors: titleStyle.colors.perWord,
    perWordSizes: titleStyle.sizes.sizes,
    visualAnalysisPrompt: result.aiPromptEnhancements,
    // New enhancements from effects library
    recommendedEffects,
    twoToneStyle,
    firstLetterEmphasis,
    layoutType,
    wordPositions
  };
}

function generateAIPromptEnhancements(
  coverAnalysis: CoverAnalysis,
  decision: ComplexityDecision
): string {
  const colorList = coverAnalysis.dominantColors
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');
  
  const placement = coverAnalysis.optimalPlacement;
  
  return `
===== VISUAL ANALYSIS OF ACTUAL COVER IMAGE =====
DOMINANT COLORS (USE THESE EXACT HEX CODES):
${colorList}

ACCENT COLORS (USE FOR HIGHLIGHTS):
${coverAnalysis.accentColors.join(', ')}

OPTIMAL PLACEMENT (based on empty space analysis):
- Position: ${placement.x.toFixed(1)}% from left, ${placement.y.toFixed(1)}% from top
- Available Area: ${placement.width.toFixed(1)}% wide × ${placement.height.toFixed(1)}% tall
- Recommended Position: ${placement.position}
- Place title HERE to avoid covering important focal points

IMAGE MOOD & STYLE:
- Mood: ${coverAnalysis.mood}
- Style: ${coverAnalysis.imageStyle}
- Color Harmony: ${coverAnalysis.colorHarmony}
- Contrast: ${(coverAnalysis.contrastScore * 100).toFixed(0)}%
- Brightness: Overall ${coverAnalysis.brightnessLevels.overall.toFixed(0)}, Top ${coverAnalysis.brightnessLevels.top.toFixed(0)}

COMPLEXITY DECISION:
- Final Score: ${(decision.finalScore * 100).toFixed(1)}%
- Style Category: ${decision.styleCategory}
- Use Unique Title: ${decision.shouldUseUnique ? 'YES' : 'NO'}
- Recommended Colors: ${decision.recommendations.colors}
- Recommended Effects: ${decision.recommendations.effects}
- Special Features: ${decision.recommendations.specialFeatures.join(', ')}

CRITICAL INSTRUCTION:
DO NOT USE GENERIC GENRE COLORS. Use the EXACT colors extracted from the cover image above.
DO NOT USE GENERIC PLACEMENT. Place the title in the optimal empty space identified above.
MATCH THE TITLE STYLE TO THE IMAGE'S VISUAL STYLE, not just the genre.
`.trim();
}

function generateCSSVariables(
  coverAnalysis: CoverAnalysis,
  titleStyle: TitleStyle
): Record<string, string> {
  const vars: Record<string, string> = {
    '--primary-color': coverAnalysis.optimalColors.primary,
    '--secondary-color': coverAnalysis.optimalColors.secondary,
    '--accent-color': coverAnalysis.optimalColors.accent,
    '--background-color': coverAnalysis.optimalColors.background,
    '--color-primary': coverAnalysis.optimalColors.primary,
    '--color-accent': coverAnalysis.optimalColors.accent,
    '--title-shadow': titleStyle.effects.shadow,
    '--title-glow': titleStyle.effects.glow,
    '--layout-alignment': titleStyle.layout.alignment,
    '--layout-type': titleStyle.layout.type,
    '--complexity-level': titleStyle.styleCategory.effectsLevel
  };
  
  if (titleStyle.colors.perWord) {
    titleStyle.colors.perWord.forEach((color, i) => {
      vars[`--word-color-${i + 1}`] = color;
      if (i % 2 === 0) {
        vars['--color-odd'] = color;
      } else {
        vars['--color-even'] = color;
      }
    });
  }
  
  titleStyle.sizes.sizes.forEach((size, i) => {
    vars[`--word-size-${i + 1}`] = `${size}em`;
  });
  
  return vars;
}

export function getComplexityBreakdown(decision: ComplexityDecision): string {
  return `
Title Complexity Analysis:
--------------------------
Final Score: ${(decision.finalScore * 100).toFixed(1)}%
Style Category: ${decision.styleCategory}
Use Unique Title: ${decision.shouldUseUnique ? 'YES' : 'NO'}

Factor Scores:
- Image Complexity: ${(decision.scores.imageComplexity * 100).toFixed(1)}%
- Genre Expectation: ${(decision.scores.genreExpectation * 100).toFixed(1)}%
- Title Potential: ${(decision.scores.titlePotential * 100).toFixed(1)}%
- Mood Intensity: ${(decision.scores.moodIntensity * 100).toFixed(1)}%
- Artistic Intent: ${(decision.scores.artisticIntent * 100).toFixed(1)}%
- Audience: ${(decision.scores.audienceAppropriate * 100).toFixed(1)}%

Recommendations:
Layout: ${decision.recommendations.layout}
Typography: ${decision.recommendations.typography}
Colors: ${decision.recommendations.colors}
Effects: ${decision.recommendations.effects}
Placement: ${decision.recommendations.placement}
Special Features: ${decision.recommendations.specialFeatures.join(', ')}
`.trim();
}

export { CoverImageAnalyzer, TitleComplexityDecider };
export type { CoverAnalysis, ComplexityDecision, TitleStyle };
