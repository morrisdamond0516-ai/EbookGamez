/**
 * Title Complexity Decider
 * Decides WHEN to use unique multi-color varied-size titles vs. simple elegant styles
 * Based on 6 weighted factors: image complexity, genre, title potential, mood, artistic intent, audience
 */

import type { CoverAnalysis } from './cover-image-analyzer';

export interface ComplexityScores {
  imageComplexity: number;
  genreExpectation: number;
  titlePotential: number;
  moodIntensity: number;
  artisticIntent: number;
  audienceAppropriate: number;
}

export type StyleCategory = 'SIMPLE_ELEGANT' | 'MODERATE_STYLIZED' | 'COMPLEX_ARTISTIC' | 'EXTREME_UNIQUE';
export type ComplexityLevel = 'minimal' | 'moderate' | 'complex' | 'extreme';

export interface StyleRecommendations {
  layout: string;
  typography: string;
  colors: string;
  effects: string;
  placement: string;
  specialFeatures: string[];
}

export interface ComplexityDecision {
  finalScore: number;
  styleCategory: StyleCategory;
  complexityLevel: ComplexityLevel;
  scores: ComplexityScores;
  recommendations: StyleRecommendations;
  shouldUseUnique: boolean;
  uniqueIntensity: number;
}

export interface TitleStyleConfig {
  layoutType: string;
  colorStrategy: 'single' | 'two-tone' | 'multi-word' | 'full-spectrum';
  fontStrategy: 'single' | 'primary-accent' | 'expressive-combo' | 'artistic-mix';
  sizeVariation: 'none' | 'word-emphasis' | 'rhythmic' | 'expressive';
  effectsLevel: 'subtle' | 'moderate' | 'premium' | 'extreme';
  animationType: string;
  specialFeatures: string[];
}

export interface GeneratedColors {
  type: string;
  primary: string;
  secondary: string;
  perWord: string[] | null;
  gradient?: string;
  transition?: string;
}

export interface GeneratedSizes {
  sizes: number[];
  pattern: string;
}

export interface TitleStyle {
  styleCategory: TitleStyleConfig;
  colors: GeneratedColors;
  sizes: GeneratedSizes;
  effects: {
    shadow: string;
    glow: string;
    texture: string;
    animation: string;
  };
  layout: {
    type: string;
    alignment: string;
    spacing: string;
  };
}

export class TitleComplexityDecider {
  private thresholds = {
    SIMPLE: 0.30,
    MODERATE: 0.60,
    COMPLEX: 0.80,
    EXTREME: 0.90
  };

  private factors = {
    IMAGE_COMPLEXITY: 0.25,
    GENRE_EXPECTATION: 0.20,
    TITLE_LENGTH: 0.15,
    MOOD_INTENSITY: 0.20,
    TARGET_AUDIENCE: 0.10,
    ARTISTIC_INTENT: 0.10
  };

  analyzeAndDecide(
    coverAnalysis: CoverAnalysis,
    titleText: string,
    genre: string,
    mood: string,
    description: string = ''
  ): ComplexityDecision {
    const scores: ComplexityScores = {
      imageComplexity: this.scoreImageComplexity(coverAnalysis),
      genreExpectation: this.scoreGenreExpectation(genre, titleText),
      titlePotential: this.scoreTitlePotential(titleText),
      moodIntensity: this.scoreMoodIntensity(mood),
      artisticIntent: this.scoreArtisticIntent(description),
      audienceAppropriate: this.scoreAudienceAppropriate(genre)
    };

    const finalScore = 
      scores.imageComplexity * this.factors.IMAGE_COMPLEXITY +
      scores.genreExpectation * this.factors.GENRE_EXPECTATION +
      scores.titlePotential * this.factors.TITLE_LENGTH +
      scores.moodIntensity * this.factors.MOOD_INTENSITY +
      scores.artisticIntent * this.factors.ARTISTIC_INTENT +
      scores.audienceAppropriate * this.factors.TARGET_AUDIENCE;

    let styleCategory: StyleCategory;
    let complexityLevel: ComplexityLevel;

    if (finalScore < this.thresholds.SIMPLE) {
      styleCategory = 'SIMPLE_ELEGANT';
      complexityLevel = 'minimal';
    } else if (finalScore < this.thresholds.MODERATE) {
      styleCategory = 'MODERATE_STYLIZED';
      complexityLevel = 'moderate';
    } else if (finalScore < this.thresholds.COMPLEX) {
      styleCategory = 'COMPLEX_ARTISTIC';
      complexityLevel = 'complex';
    } else {
      styleCategory = 'EXTREME_UNIQUE';
      complexityLevel = 'extreme';
    }

    const recommendations = this.generateRecommendations(styleCategory, scores, coverAnalysis, titleText);

    return {
      finalScore,
      styleCategory,
      complexityLevel,
      scores,
      recommendations,
      shouldUseUnique: finalScore >= this.thresholds.SIMPLE,
      uniqueIntensity: finalScore
    };
  }

  private scoreImageComplexity(coverAnalysis: CoverAnalysis): number {
    let score = 0;

    const emptySpaceRatio = coverAnalysis.emptyAreas.length / 64;
    score += (1 - emptySpaceRatio) * 0.4;

    const focalDensity = Math.min(coverAnalysis.focalPoints.length / 10, 1);
    score += focalDensity * 0.3;

    const contrastFactor = coverAnalysis.contrastScore || 0.5;
    score += (1 - contrastFactor) * 0.3;

    return Math.min(score, 1);
  }

  private scoreGenreExpectation(genre: string, titleText: string): number {
    const genreMap: Record<string, number> = {
      'fantasy': 0.9,
      'science fiction': 0.8,
      'scifi': 0.8,
      'horror': 0.7,
      'children': 0.8,
      'graphic novel': 0.9,
      'young adult': 0.7,
      'mystery': 0.6,
      'thriller': 0.6,
      'adventure': 0.5,
      'romance': 0.4,
      'literary': 0.3,
      'historical': 0.3,
      'historical fiction': 0.3,
      'biography': 0.2,
      'business': 0.2,
      'business & finance': 0.2,
      'self-help': 0.2,
      'self help': 0.2,
      'health & wellness': 0.3,
      'psychology': 0.3,
      'productivity': 0.2,
      'spirituality': 0.4,
      'academic': 0.1
    };

    const genreLower = genre.toLowerCase();
    let baseScore = 0.5;
    
    for (const [key, value] of Object.entries(genreMap)) {
      if (genreLower.includes(key)) {
        baseScore = value;
        break;
      }
    }

    const titleLower = titleText.toLowerCase();
    const fantasyWords = ['dragon', 'magic', 'kingdom', 'quest', 'sword', 'wizard', 'realm'];
    const scifiWords = ['star', 'space', 'alien', 'future', 'robot', 'cyber', 'neural', 'empire'];
    const horrorWords = ['dark', 'shadow', 'night', 'blood', 'fear', 'ghost', 'dread', 'forbidden'];

    let contentBoost = 0;
    if (fantasyWords.some(word => titleLower.includes(word))) contentBoost += 0.15;
    if (scifiWords.some(word => titleLower.includes(word))) contentBoost += 0.15;
    if (horrorWords.some(word => titleLower.includes(word))) contentBoost += 0.1;

    return Math.min(baseScore + contentBoost, 1);
  }

  private scoreTitlePotential(titleText: string): number {
    const words = titleText.split(' ');
    const characters = titleText.length;
    
    let score = 0;

    if (words.length >= 6) score += 0.4;
    else if (words.length >= 4) score += 0.3;
    else if (words.length >= 2) score += 0.2;
    else score += 0.1;

    const hasMixedCase = /[A-Z]/.test(titleText) && /[a-z]/.test(titleText);
    const hasPunctuation = /[!?:;—–\-]/.test(titleText);
    const hasNumbers = /\d/.test(titleText);

    if (hasMixedCase) score += 0.15;
    if (hasPunctuation) score += 0.15;
    if (hasNumbers) score += 0.1;

    const structuralScore = this.analyzeTitleStructure(titleText);
    score += structuralScore * 0.2;

    return Math.min(score, 1);
  }

  private analyzeTitleStructure(titleText: string): number {
    const words = titleText.split(' ');
    
    let emphasisPoints = 0;
    const emphasisPatterns = [
      /^the /i, /^a /i, /^an /i,
      / and /i, / or /i, / of /i,
      /:/, /—/, /-/,
      /volume/i, /book/i, /part/i
    ];

    emphasisPatterns.forEach(pattern => {
      if (pattern.test(titleText)) emphasisPoints++;
    });

    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const hasRepeats = uniqueWords.size < words.length;

    const firstLetters = words.map(w => w[0]?.toLowerCase()).filter(Boolean);
    const uniqueFirstLetters = new Set(firstLetters);
    const hasAlliteration = uniqueFirstLetters.size < words.length * 0.7;

    let structureScore = 0;
    if (words.length >= 4) structureScore += 0.3;
    if (emphasisPoints >= 2) structureScore += 0.3;
    if (hasRepeats) structureScore += 0.2;
    if (hasAlliteration) structureScore += 0.2;

    return Math.min(structureScore, 1);
  }

  private scoreMoodIntensity(mood: string): number {
    const moodMap: Record<string, number> = {
      'epic': 0.9,
      'dramatic': 0.8,
      'intense': 0.8,
      'mysterious': 0.7,
      'dark': 0.7,
      'thrilling': 0.6,
      'romantic': 0.5,
      'whimsical': 0.6,
      'hopeful': 0.4,
      'calm': 0.3,
      'peaceful': 0.2,
      'serious': 0.4,
      'academic': 0.2,
      'dark-dramatic': 0.85,
      'dark-mysterious': 0.8,
      'warm-hopeful': 0.45,
      'ethereal': 0.6,
      'futuristic': 0.7
    };

    const moodLower = mood.toLowerCase();
    
    for (const [key, value] of Object.entries(moodMap)) {
      if (moodLower.includes(key)) {
        return value;
      }
    }

    return 0.5;
  }

  private scoreArtisticIntent(description: string): number {
    if (!description) return 0.3;

    const artisticKeywords = [
      'unique', 'artistic', 'innovative', 'experimental',
      'avant-garde', 'groundbreaking', 'unconventional',
      'stylized', 'visual', 'graphic', 'illustrated',
      'creative', 'bold', 'striking', 'dramatic'
    ];

    const descLower = description.toLowerCase();
    let score = 0.3;

    artisticKeywords.forEach(keyword => {
      if (descLower.includes(keyword)) {
        score += 0.08;
      }
    });

    return Math.min(score, 1);
  }

  private scoreAudienceAppropriate(genre: string): number {
    const audienceMap: Record<string, number> = {
      'children': 0.9,
      'young adult': 0.8,
      'graphic novel': 0.9,
      'fantasy': 0.7,
      'science fiction': 0.7,
      'scifi': 0.7,
      'horror': 0.6,
      'romance': 0.4,
      'literary': 0.2,
      'business': 0.1,
      'academic': 0.1,
      'self-help': 0.3,
      'psychology': 0.3,
      'spirituality': 0.4
    };

    const genreLower = genre.toLowerCase();
    
    for (const [key, value] of Object.entries(audienceMap)) {
      if (genreLower.includes(key)) {
        return value;
      }
    }

    return 0.5;
  }

  private generateRecommendations(
    styleCategory: StyleCategory,
    scores: ComplexityScores,
    coverAnalysis: CoverAnalysis,
    titleText: string
  ): StyleRecommendations {
    const recommendations: StyleRecommendations = {
      layout: '',
      typography: '',
      colors: '',
      effects: '',
      placement: '',
      specialFeatures: []
    };

    switch (styleCategory) {
      case 'SIMPLE_ELEGANT':
        recommendations.layout = 'Single line, centered alignment';
        recommendations.typography = 'One font family, consistent size';
        recommendations.colors = 'Single color or subtle gradient';
        recommendations.effects = 'Minimal shadow or glow';
        recommendations.placement = 'Standard position (top or center)';
        recommendations.specialFeatures = ['Clean lines', 'High readability'];
        break;

      case 'MODERATE_STYLIZED':
        recommendations.layout = 'Hierarchical sizing (first word larger)';
        recommendations.typography = 'Primary font with accent font for author';
        recommendations.colors = 'Two-color scheme with gradient';
        recommendations.effects = 'Moderate shadow + glow combination';
        recommendations.placement = 'Dynamic placement based on image empty space';
        recommendations.specialFeatures = ['Word emphasis', 'Subtle animation'];
        break;

      case 'COMPLEX_ARTISTIC':
        recommendations.layout = 'Multi-line or artistic arrangement';
        recommendations.typography = '2-3 fonts with varied weights';
        recommendations.colors = 'Multi-color per word or gradient per letter';
        recommendations.effects = 'Layered effects (shadow + glow + texture)';
        recommendations.placement = 'Integrated with image composition';
        recommendations.specialFeatures = [
          'Varied letter sizes',
          'Color transitions',
          'Dynamic positioning'
        ];
        break;

      case 'EXTREME_UNIQUE':
        recommendations.layout = 'Experimental or unconventional arrangement';
        recommendations.typography = 'Custom font combinations (3+ fonts)';
        recommendations.colors = 'Full spectrum or unexpected color combinations';
        recommendations.effects = 'Multiple premium effects combined';
        recommendations.placement = 'Breaks conventional placement rules';
        recommendations.specialFeatures = [
          'Animated elements',
          'Interactive effects',
          'Mixed typography styles',
          'Artistic distortion',
          'Custom letter treatments'
        ];
        break;
    }

    if (scores.titlePotential > 0.7) {
      recommendations.specialFeatures.push('Word-by-word styling');
    }

    if (coverAnalysis.dominantColors.length >= 3) {
      recommendations.specialFeatures.push('Multi-color gradient');
    }

    if (scores.moodIntensity > 0.7) {
      recommendations.effects += ' + mood-appropriate animation';
    }

    return recommendations;
  }

  generateTitleStyle(
    decision: ComplexityDecision,
    coverAnalysis: CoverAnalysis,
    titleText: string,
    genre: string
  ): TitleStyle {
    const { styleCategory, uniqueIntensity } = decision;

    let styleConfig: TitleStyleConfig = {
      layoutType: 'linear',
      colorStrategy: 'single',
      fontStrategy: 'single',
      sizeVariation: 'none',
      effectsLevel: 'subtle',
      animationType: 'none',
      specialFeatures: []
    };

    switch (styleCategory) {
      case 'SIMPLE_ELEGANT':
        styleConfig = {
          layoutType: 'linear',
          colorStrategy: 'single',
          fontStrategy: 'single',
          sizeVariation: 'none',
          effectsLevel: 'subtle',
          animationType: 'fade-in',
          specialFeatures: []
        };
        break;

      case 'MODERATE_STYLIZED':
        styleConfig = {
          layoutType: 'hierarchical',
          colorStrategy: 'two-tone',
          fontStrategy: 'primary-accent',
          sizeVariation: 'word-emphasis',
          effectsLevel: 'moderate',
          animationType: 'gentle-float',
          specialFeatures: ['first-word-emphasis', 'gradient-title']
        };
        break;

      case 'COMPLEX_ARTISTIC':
        styleConfig = {
          layoutType: this.chooseArtisticLayout(titleText),
          colorStrategy: 'multi-word',
          fontStrategy: 'expressive-combo',
          sizeVariation: 'rhythmic',
          effectsLevel: 'premium',
          animationType: 'mood-based',
          specialFeatures: [
            'per-word-colors',
            'varied-sizes',
            'dynamic-positioning',
            'layered-effects'
          ]
        };
        break;

      case 'EXTREME_UNIQUE':
        styleConfig = {
          layoutType: this.chooseExperimentalLayout(titleText, coverAnalysis),
          colorStrategy: 'full-spectrum',
          fontStrategy: 'artistic-mix',
          sizeVariation: 'expressive',
          effectsLevel: 'extreme',
          animationType: 'interactive',
          specialFeatures: [
            'animated-letters',
            'color-cycling',
            'mixed-fonts',
            'artistic-distortion',
            'custom-shapes',
            'interactive-elements'
          ]
        };
        break;
    }

    const words = titleText.split(' ');
    const colors = this.generateColorScheme(styleConfig.colorStrategy, coverAnalysis.dominantColors, words.length);
    const sizes = this.generateSizeVariations(styleConfig.sizeVariation, words, uniqueIntensity);
    const effects = this.generateEffects(styleConfig.effectsLevel, genre, uniqueIntensity);
    const layout = this.generateLayout(styleConfig.layoutType, words);

    return {
      styleCategory: styleConfig,
      colors,
      sizes,
      effects,
      layout
    };
  }

  private chooseArtisticLayout(titleText: string): string {
    const words = titleText.split(' ');

    if (words.length === 1) return 'expanded';
    if (words.length === 2) return 'stacked';
    if (words.length === 3) return 'triangular';
    
    if (words.length >= 4) {
      const hasConjunction = / and | or | & /.test(titleText);
      if (hasConjunction) return 'split-flow';

      const hasColon = /:/.test(titleText);
      if (hasColon) return 'divided';

      return 'artistic-flow';
    }

    return 'staggered';
  }

  private chooseExperimentalLayout(titleText: string, coverAnalysis: CoverAnalysis): string {
    if (coverAnalysis.focalPoints.length > 3) {
      return 'path-following';
    }

    if (coverAnalysis.emptyAreas.length === 0) {
      return 'integrated-with-image';
    }

    const wordCount = titleText.split(' ').length;
    if (wordCount >= 5) return 'wave';
    if (wordCount === 1) return 'expanded-artistic';

    return 'breaking-boundaries';
  }

  private generateColorScheme(strategy: TitleStyleConfig['colorStrategy'], dominantColors: string[], wordCount: number): GeneratedColors {
    switch (strategy) {
      case 'single':
        return {
          type: 'single',
          primary: dominantColors[0] || '#FFFFFF',
          secondary: dominantColors[0] || '#FFFFFF',
          perWord: null
        };

      case 'two-tone':
        const secondary = dominantColors[1] || this.getComplementary(dominantColors[0] || '#FFFFFF');
        return {
          type: 'gradient',
          primary: dominantColors[0] || '#FFFFFF',
          secondary,
          gradient: `linear-gradient(90deg, ${dominantColors[0] || '#FFFFFF'}, ${secondary})`,
          perWord: null
        };

      case 'multi-word':
        const perWordColors: string[] = [];
        for (let i = 0; i < wordCount; i++) {
          perWordColors.push(
            dominantColors[i % dominantColors.length] ||
            this.generateColorVariant(dominantColors[0] || '#FFFFFF', i)
          );
        }
        return {
          type: 'per-word',
          primary: dominantColors[0] || '#FFFFFF',
          secondary: dominantColors[1] || this.getComplementary(dominantColors[0] || '#FFFFFF'),
          perWord: perWordColors,
          transition: 'smooth'
        };

      case 'full-spectrum':
        const spectrumColors = this.generateColorSpectrum(wordCount);
        return {
          type: 'spectrum',
          primary: spectrumColors[0],
          secondary: spectrumColors[spectrumColors.length - 1],
          perWord: spectrumColors,
          gradient: `linear-gradient(90deg, ${spectrumColors.join(', ')})`
        };

      default:
        return {
          type: 'single',
          primary: '#FFFFFF',
          secondary: '#FFFFFF',
          perWord: null
        };
    }
  }

  private generateSizeVariations(strategy: TitleStyleConfig['sizeVariation'], words: string[], intensity: number): GeneratedSizes {
    const baseSize = 1.0;

    switch (strategy) {
      case 'none':
        return {
          sizes: words.map(() => baseSize),
          pattern: 'uniform'
        };

      case 'word-emphasis':
        return {
          sizes: words.map((_, i) => i === 0 ? baseSize * 1.3 : baseSize),
          pattern: 'first-emphasis'
        };

      case 'rhythmic':
        return {
          sizes: words.map((_, i) => {
            const pattern = i % 3;
            if (pattern === 0) return baseSize * 1.2;
            if (pattern === 1) return baseSize;
            return baseSize * 0.85;
          }),
          pattern: 'rhythmic'
        };

      case 'expressive':
        return {
          sizes: words.map((word, i) => {
            const wordImportance = this.scoreWordImportance(word, i, words.length);
            const lengthFactor = Math.min(word.length / 10, 0.3);
            return baseSize * (0.8 + wordImportance * 0.4 + lengthFactor);
          }),
          pattern: 'expressive'
        };

      default:
        return {
          sizes: words.map(() => baseSize),
          pattern: 'uniform'
        };
    }
  }

  private scoreWordImportance(word: string, position: number, totalWords: number): number {
    const wordLower = word.toLowerCase();

    const commonWords = ['the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for'];
    if (commonWords.includes(wordLower)) return 0.1;

    let positionScore = 0;
    if (position === 0) positionScore = 0.3;
    if (position === totalWords - 1) positionScore = 0.2;

    const lengthScore = Math.min(word.length / 15, 0.2);
    const capsScore = word[0] === word[0].toUpperCase() ? 0.1 : 0;

    return 0.4 + positionScore + lengthScore + capsScore;
  }

  private generateEffects(level: TitleStyleConfig['effectsLevel'], genre: string, intensity: number): TitleStyle['effects'] {
    switch (level) {
      case 'subtle':
        return {
          shadow: '2px 2px 4px rgba(0,0,0,0.2)',
          glow: 'none',
          texture: '',
          animation: ''
        };

      case 'moderate':
        return {
          shadow: '3px 3px 8px rgba(0,0,0,0.3)',
          glow: '0 0 10px rgba(255,255,255,0.3)',
          texture: '',
          animation: ''
        };

      case 'premium':
        return {
          shadow: '4px 4px 12px rgba(0,0,0,0.4), -2px -2px 6px rgba(255,255,255,0.1)',
          glow: '0 0 20px rgba(255,215,0,0.5)',
          texture: 'overlay',
          animation: 'shimmer'
        };

      case 'extreme':
        return {
          shadow: '6px 6px 20px rgba(0,0,0,0.6), -3px -3px 10px rgba(255,255,255,0.2)',
          glow: '0 0 30px rgba(255,215,0,0.7), 0 0 60px rgba(147,112,219,0.4)',
          texture: 'multiple',
          animation: 'pulse, color-cycle, float'
        };

      default:
        return {
          shadow: '2px 2px 4px rgba(0,0,0,0.2)',
          glow: 'none',
          texture: '',
          animation: ''
        };
    }
  }

  private generateLayout(layoutType: string, words: string[]): TitleStyle['layout'] {
    const alignments: Record<string, string> = {
      'linear': 'center',
      'hierarchical': 'center',
      'staggered': 'center',
      'curved': 'center',
      'wave': 'center',
      'stacked': 'center',
      'triangular': 'center',
      'split-flow': 'center',
      'divided': 'center',
      'artistic-flow': 'center',
      'expanded': 'center',
      'expanded-artistic': 'center',
      'path-following': 'left',
      'integrated-with-image': 'center',
      'breaking-boundaries': 'center'
    };

    return {
      type: layoutType,
      alignment: alignments[layoutType] || 'center',
      spacing: layoutType === 'linear' ? 'normal' : 'variable'
    };
  }

  private getComplementary(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `#${(255 - r).toString(16).padStart(2, '0')}${(255 - g).toString(16).padStart(2, '0')}${(255 - b).toString(16).padStart(2, '0')}`;
  }

  private generateColorVariant(baseColor: string, index: number): string {
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);

    const shift = (index * 40) % 256;
    const newR = (r + shift) % 256;
    const newG = (g + shift * 2) % 256;
    const newB = (b + shift * 3) % 256;

    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  private generateColorSpectrum(count: number): string[] {
    const colors: string[] = [];
    const hueStep = 360 / count;

    for (let i = 0; i < count; i++) {
      const hue = (i * hueStep) % 360;
      colors.push(`hsl(${hue}, 70%, 50%)`);
    }

    return colors;
  }
}
