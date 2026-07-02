/**
 * Title Perfection Engine
 * Complete solution for intelligent title styling on ebook covers
 * Adapted from vanilla JS to work with React architecture
 */

export interface CoverAnalysis {
  dimensions: { width: number; height: number };
  dominantColors: string[];
  averageBrightness: number;
  contrastAreas: { x: number; y: number; contrast: number }[];
  emptySpaces: { x: number; y: number; width: number; height: number }[];
  focalPoints: { x: number; y: number; intensity: number }[];
  colorHarmony: string;
  imageStyle: string;
  mood: string;
}

export interface PerfectColors {
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
  perWord: string[];
  shadow: string;
  glow: string;
}

export interface StyleDecision {
  complexityLevel: 'simple' | 'moderate' | 'complex';
  useTwoTone: boolean;
  useMultiColor: boolean;
  useFirstLetterEmphasis: boolean;
  layoutType: 'simple' | 'curved' | 'staggered' | 'artistic';
  effectIntensity: 'subtle' | 'moderate' | 'intense';
}

export interface TitleLayout {
  type: string;
  alignment: string;
  wordPositions: { x: number; y: number; rotation: number; scale: number }[];
  container: { left: string; top: string; transform: string };
}

export interface SelectedEffects {
  primary: string;
  secondary: string;
  animation: string;
}

export interface PerfectTitleDesign {
  colors: PerfectColors;
  layout: TitleLayout;
  effects: SelectedEffects;
  styleDecision: StyleDecision;
  cssVariables: Record<string, string>;
  effectClasses: string[];
}

export class TitlePerfectionEngine {
  private effectsLibrary = {
    glows: ['elegant-glow', 'soft-glow', 'gold-glow', 'neon-glow', 'cosmic-glow', 'fire-glow'],
    shadows: ['soft-shadow', 'hard-shadow', 'long-shadow', 'floating-shadow', 'perspective-shadow'],
    textures: ['gold-leaf', 'velvet', 'metal', 'crystal', 'gradient-texture'],
    animations: ['fade-in', 'float', 'pulse', 'wave', 'bounce', 'typewriter'],
    borders: ['solid', 'dotted', 'gradient', 'glowing', 'ornamental'],
    special: ['3d-extrude', 'liquid', 'sparkle', 'rainbow', 'two-tone']
  };

  async generatePerfectTitle(
    coverImageUrl: string,
    titleText: string,
    author: string,
    genre: string
  ): Promise<PerfectTitleDesign> {
    console.log('🎯 Title Perfection Engine: Starting...');

    try {
      const coverAnalysis = await this.analyzeCoverImage(coverImageUrl);
      const perfectColors = this.findPerfectTitleColors(coverAnalysis, titleText);
      const styleDecision = this.decideTitleStyle(coverAnalysis, titleText, genre);
      const layout = this.generateTitleLayout(coverAnalysis, titleText, styleDecision);
      const effects = this.selectAppropriateEffects(coverAnalysis, genre, styleDecision);

      const cssVariables = this.generateCSSVariables(perfectColors, styleDecision);
      const effectClasses = this.generateEffectClasses(effects, styleDecision);

      console.log('✅ Title Perfection Engine: Complete!', { styleDecision, layout });

      return {
        colors: perfectColors,
        layout,
        effects,
        styleDecision,
        cssVariables,
        effectClasses
      };
    } catch (error) {
      console.error('Title Perfection Engine failed:', error);
      return this.getFallbackDesign(titleText, genre);
    }
  }

  async analyzeCoverImage(imageUrl: string): Promise<CoverAnalysis> {
    console.log('📊 Analyzing cover image...');

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(this.getDefaultAnalysis());
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const analysis: CoverAnalysis = {
          dimensions: { width: img.width, height: img.height },
          dominantColors: this.extractDominantColors(imageData),
          averageBrightness: this.calculateAverageBrightness(imageData),
          contrastAreas: this.findHighContrastAreas(imageData, canvas.width, canvas.height),
          emptySpaces: this.findEmptySpaces(imageData, canvas.width, canvas.height),
          focalPoints: this.detectFocalPoints(imageData, canvas.width, canvas.height),
          colorHarmony: this.analyzeColorHarmony(imageData),
          imageStyle: this.determineImageStyle(imageData),
          mood: this.analyzeImageMood(imageData)
        };

        resolve(analysis);
      };
      img.onerror = () => resolve(this.getDefaultAnalysis());
      img.src = imageUrl;
    });
  }

  extractDominantColors(imageData: ImageData): string[] {
    const colors = new Map<string, number>();
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 16) {
      const r = Math.round(data[i] / 32) * 32;
      const g = Math.round(data[i + 1] / 32) * 32;
      const b = Math.round(data[i + 2] / 32) * 32;
      const key = `${r},${g},${b}`;
      colors.set(key, (colors.get(key) || 0) + 1);
    }

    return Array.from(colors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });
  }

  calculateAverageBrightness(imageData: ImageData): number {
    const data = imageData.data;
    let totalBrightness = 0;
    let pixelCount = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      pixelCount++;
    }

    return totalBrightness / pixelCount;
  }

  findHighContrastAreas(imageData: ImageData, width: number, height: number): { x: number; y: number; contrast: number }[] {
    const areas: { x: number; y: number; contrast: number }[] = [];
    const gridSize = 8;
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const contrast = this.measureLocalContrast(imageData, gx * cellWidth, gy * cellHeight, cellWidth, cellHeight, width);
        if (contrast > 0.3) {
          areas.push({ x: gx * cellWidth + cellWidth / 2, y: gy * cellHeight + cellHeight / 2, contrast });
        }
      }
    }

    return areas.sort((a, b) => b.contrast - a.contrast).slice(0, 5);
  }

  measureLocalContrast(imageData: ImageData, startX: number, startY: number, w: number, h: number, imageWidth: number): number {
    let min = 255, max = 0;
    const data = imageData.data;

    for (let y = startY; y < startY + h && y < imageData.height; y += 4) {
      for (let x = startX; x < startX + w && x < imageWidth; x += 4) {
        const i = (y * imageWidth + x) * 4;
        if (i < data.length) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          min = Math.min(min, brightness);
          max = Math.max(max, brightness);
        }
      }
    }

    return (max - min) / 255;
  }

  findEmptySpaces(imageData: ImageData, width: number, height: number): { x: number; y: number; width: number; height: number }[] {
    const spaces: { x: number; y: number; width: number; height: number }[] = [];
    const gridSize = 6;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const cellW = width / gridSize;
        const cellH = height / gridSize;
        const variance = this.measureVariance(imageData, gx * cellW, gy * cellH, cellW, cellH, width);
        
        if (variance < 0.1) {
          spaces.push({
            x: (gx * cellW + cellW / 2) / width * 100,
            y: (gy * cellH + cellH / 2) / height * 100,
            width: cellW / width * 100,
            height: cellH / height * 100
          });
        }
      }
    }

    return spaces.slice(0, 5);
  }

  measureVariance(imageData: ImageData, startX: number, startY: number, w: number, h: number, imageWidth: number): number {
    const values: number[] = [];
    const data = imageData.data;

    for (let y = startY; y < startY + h && y < imageData.height; y += 4) {
      for (let x = startX; x < startX + w && x < imageWidth; x += 4) {
        const i = (y * imageWidth + x) * 4;
        if (i < data.length) {
          values.push((data[i] + data[i + 1] + data[i + 2]) / 3);
        }
      }
    }

    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / 255;
  }

  detectFocalPoints(imageData: ImageData, width: number, height: number): { x: number; y: number; intensity: number }[] {
    const contrastAreas = this.findHighContrastAreas(imageData, width, height);
    return contrastAreas.map(area => ({
      x: area.x / width * 100,
      y: area.y / height * 100,
      intensity: area.contrast
    }));
  }

  analyzeColorHarmony(imageData: ImageData): string {
    const colors = this.extractDominantColors(imageData);
    if (colors.length < 2) return 'monochromatic';

    const hues = colors.map(c => this.getHue(c));
    const hueDiffs = hues.slice(1).map((h, i) => Math.abs(h - hues[i]));
    const avgDiff = hueDiffs.reduce((a, b) => a + b, 0) / hueDiffs.length;

    if (avgDiff < 30) return 'analogous';
    if (avgDiff > 150 && avgDiff < 210) return 'complementary';
    if (avgDiff > 100 && avgDiff < 140) return 'triadic';
    return 'split-complementary';
  }

  determineImageStyle(imageData: ImageData): string {
    const brightness = this.calculateAverageBrightness(imageData);
    const colors = this.extractDominantColors(imageData);
    
    if (brightness < 0.3) return 'dark-dramatic';
    if (brightness > 0.7) return 'bright-clean';
    if (colors.length > 5) return 'vibrant-colorful';
    return 'balanced-natural';
  }

  analyzeImageMood(imageData: ImageData): string {
    const brightness = this.calculateAverageBrightness(imageData);
    const colors = this.extractDominantColors(imageData);
    
    const hasWarmColors = colors.some(c => {
      const hue = this.getHue(c);
      return hue < 60 || hue > 300;
    });

    const hasCoolColors = colors.some(c => {
      const hue = this.getHue(c);
      return hue > 180 && hue < 300;
    });

    if (brightness < 0.3) return hasWarmColors ? 'dramatic' : 'mysterious';
    if (brightness > 0.7) return hasWarmColors ? 'cheerful' : 'serene';
    if (hasWarmColors && !hasCoolColors) return 'warm';
    if (hasCoolColors && !hasWarmColors) return 'cool';
    return 'balanced';
  }

  findPerfectTitleColors(analysis: CoverAnalysis, titleText: string): PerfectColors {
    console.log('🎨 Finding perfect title colors...');

    const colors = analysis.dominantColors;
    if (!colors || colors.length === 0) {
      return this.getDefaultColors();
    }

    const scoredColors = colors.map(color => ({
      color,
      score: this.scoreColorForTitle(color, analysis)
    })).sort((a, b) => b.score - a.score);

    const bestColor = scoredColors[0].color;
    const words = titleText.split(' ');

    return {
      primary: this.ensureReadability(bestColor, analysis.averageBrightness),
      secondary: this.findContrastColor(bestColor, colors),
      accent: this.findAccentColor(bestColor, colors),
      gradient: this.createSmartGradient(bestColor, colors),
      perWord: this.createWordColorPalette(bestColor, words, colors),
      shadow: this.calculateShadowColor(bestColor, analysis.averageBrightness),
      glow: this.calculateGlowColor(bestColor, analysis.mood)
    };
  }

  scoreColorForTitle(color: string, analysis: CoverAnalysis): number {
    let score = 0;

    const contrast = this.calculateColorContrast(color, analysis.dominantColors[0] || '#000000');
    score += contrast * 0.4;

    const visibility = Math.abs(this.getBrightness(color) - analysis.averageBrightness);
    score += visibility * 0.3;

    const saturation = this.getSaturation(color);
    score += saturation * 0.2;

    score += 0.1;

    return score;
  }

  ensureReadability(color: string, backgroundBrightness: number): string {
    const colorBrightness = this.getBrightness(color);
    const contrast = Math.abs(colorBrightness - backgroundBrightness);

    if (contrast < 0.3) {
      return backgroundBrightness > 0.5 ? this.darkenColor(color, 40) : this.lightenColor(color, 40);
    }

    return color;
  }

  findContrastColor(baseColor: string, colorPalette: string[]): string {
    const baseHue = this.getHue(baseColor);

    let maxDiff = 0;
    let contrastColor = baseColor;

    colorPalette.forEach(color => {
      if (color !== baseColor) {
        const hue = this.getHue(color);
        const diff = Math.min(Math.abs(hue - baseHue), 360 - Math.abs(hue - baseHue));
        if (diff > maxDiff) {
          maxDiff = diff;
          contrastColor = color;
        }
      }
    });

    return contrastColor;
  }

  findAccentColor(baseColor: string, colorPalette: string[]): string {
    const filtered = colorPalette.filter(c => {
      const sat = this.getSaturation(c);
      return sat > 0.3;
    });

    return filtered[0] || this.getComplementaryColor(baseColor);
  }

  createSmartGradient(baseColor: string, colors: string[]): string {
    const secondary = this.findContrastColor(baseColor, colors);
    return `linear-gradient(135deg, ${baseColor} 0%, ${secondary} 100%)`;
  }

  createWordColorPalette(baseColor: string, words: string[], colors: string[]): string[] {
    if (words.length <= 2) {
      return [baseColor, this.findContrastColor(baseColor, colors)];
    }

    const palette: string[] = [];
    for (let i = 0; i < words.length; i++) {
      if (i === 0) {
        palette.push(this.findAccentColor(baseColor, colors));
      } else {
        const colorIndex = i % colors.length;
        palette.push(this.ensureReadability(colors[colorIndex], 0.5));
      }
    }
    return palette;
  }

  calculateShadowColor(baseColor: string, brightness: number): string {
    if (brightness > 0.5) {
      return `rgba(0, 0, 0, 0.5)`;
    }
    return `rgba(0, 0, 0, 0.8)`;
  }

  calculateGlowColor(baseColor: string, mood: string): string {
    const rgb = this.hexToRgb(baseColor);
    if (!rgb) return 'rgba(255, 255, 255, 0.3)';
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
  }

  decideTitleStyle(analysis: CoverAnalysis, titleText: string, genre: string): StyleDecision {
    console.log('🤔 Deciding title style...');

    const words = titleText.split(' ');
    const factors = {
      imageComplexity: analysis.focalPoints.length,
      availableSpace: analysis.emptySpaces.length,
      titleLength: words.length,
      genre,
      imageMood: analysis.mood,
      colorCount: analysis.dominantColors.length
    };

    const complexityScore = this.calculateComplexityScore(factors);

    return {
      complexityLevel: complexityScore > 0.7 ? 'complex' : complexityScore > 0.4 ? 'moderate' : 'simple',
      useTwoTone: this.shouldUseTwoTone(factors),
      useMultiColor: this.shouldUseMultiColor(factors),
      useFirstLetterEmphasis: this.shouldUseFirstLetterEmphasis(words),
      layoutType: this.chooseLayoutType(factors),
      effectIntensity: this.determineEffectIntensity(factors)
    };
  }

  calculateComplexityScore(factors: any): number {
    let score = 0;

    score += Math.min(factors.imageComplexity / 10, 1) * 0.2;
    score += Math.min(factors.titleLength / 10, 1) * 0.2;

    const genreComplexity: Record<string, number> = {
      children: 0.8, fantasy: 0.7, 'science fiction': 0.6, scifi: 0.6, mystery: 0.5,
      romance: 0.4, business: 0.3, 'business & finance': 0.3, academic: 0.2,
      horror: 0.6, 'self-help': 0.3, psychology: 0.4, 'health & wellness': 0.3,
      spirituality: 0.5, productivity: 0.3, 'historical fiction': 0.5
    };
    score += (genreComplexity[factors.genre?.toLowerCase()] || 0.5) * 0.3;

    score += Math.min(factors.colorCount / 8, 1) * 0.15;

    const moodComplexity: Record<string, number> = {
      playful: 0.8, dramatic: 0.7, mysterious: 0.6, warm: 0.5,
      cheerful: 0.4, serene: 0.3, cool: 0.4, balanced: 0.5
    };
    score += (moodComplexity[factors.imageMood] || 0.5) * 0.15;

    return score;
  }

  shouldUseTwoTone(factors: any): boolean {
    return factors.colorCount >= 3 && factors.titleLength <= 4;
  }

  shouldUseMultiColor(factors: any): boolean {
    const complexGenres = ['children', 'fantasy', 'science fiction', 'scifi'];
    return complexGenres.includes(factors.genre?.toLowerCase()) && factors.titleLength >= 3;
  }

  shouldUseFirstLetterEmphasis(words: string[]): boolean {
    // DISABLED - was triggering too often and creating inconsistent styling
    // Only enable for very specific cases
    return false;
  }

  chooseLayoutType(factors: any): 'simple' | 'curved' | 'staggered' | 'artistic' {
    if (factors.titleLength <= 2 && factors.availableSpace > 2) return 'simple';
    if (factors.genre?.toLowerCase() === 'children' || factors.genre?.toLowerCase() === 'fantasy') return 'curved';
    if (factors.titleLength >= 5) return 'staggered';
    if (factors.imageComplexity > 5) return 'artistic';
    return 'simple';
  }

  determineEffectIntensity(factors: any): 'subtle' | 'moderate' | 'intense' {
    const intenseGenres = ['fantasy', 'horror', 'science fiction', 'scifi'];
    const subtleGenres = ['business', 'academic', 'self-help', 'psychology'];

    if (intenseGenres.includes(factors.genre?.toLowerCase())) return 'intense';
    if (subtleGenres.includes(factors.genre?.toLowerCase())) return 'subtle';
    return 'moderate';
  }

  generateTitleLayout(analysis: CoverAnalysis, titleText: string, styleDecision: StyleDecision): TitleLayout {
    console.log('📐 Generating title layout...');

    const words = titleText.split(' ');
    const bestSpace = analysis.emptySpaces[0] || { x: 50, y: 30, width: 80, height: 30 };

    switch (styleDecision.layoutType) {
      case 'curved':
        return this.createCurvedLayout(words, bestSpace);
      case 'staggered':
        return this.createStaggeredLayout(words, bestSpace);
      case 'artistic':
        return this.createArtisticLayout(words, analysis.focalPoints);
      default:
        return this.createSimpleLayout(words, bestSpace);
    }
  }

  createSimpleLayout(words: string[], placementArea: any): TitleLayout {
    return {
      type: 'linear',
      alignment: 'center',
      wordPositions: words.map((_, i) => ({
        x: 50,
        y: 30 + (i * 8),
        rotation: 0,
        scale: 1.0
      })),
      container: {
        left: `${placementArea.x}%`,
        top: `${placementArea.y}%`,
        transform: 'translate(-50%, -50%)'
      }
    };
  }

  createCurvedLayout(words: string[], placementArea: any): TitleLayout {
    const radius = Math.min(40, words.length * 8);
    const startAngle = -Math.PI / 6;
    const angleStep = words.length > 1 ? (Math.PI / 3) / (words.length - 1) : 0;

    return {
      type: 'arc-up',
      alignment: 'center',
      wordPositions: words.map((_, i) => {
        const angle = startAngle + (angleStep * i);
        return {
          x: 50 + Math.cos(angle) * radius,
          y: 35 + Math.sin(angle) * radius * 0.5,
          rotation: (angle * 180 / Math.PI) * 0.3,
          scale: 1.0 - (Math.abs(i - words.length / 2) * 0.05)
        };
      }),
      container: {
        left: `${placementArea.x}%`,
        top: `${placementArea.y}%`,
        transform: 'translate(-50%, -50%)'
      }
    };
  }

  createStaggeredLayout(words: string[], placementArea: any): TitleLayout {
    return {
      type: 'staggered',
      alignment: 'dynamic',
      wordPositions: words.map((_, i) => ({
        x: 50 + (i % 2 === 0 ? -5 : 5),
        y: 25 + (i * 7),
        rotation: (i % 2 === 0 ? -2 : 2),
        scale: 1.0 + (i === 0 ? 0.1 : 0)
      })),
      container: {
        left: `${placementArea.x}%`,
        top: `${placementArea.y}%`,
        transform: 'translate(-50%, -50%)'
      }
    };
  }

  createArtisticLayout(words: string[], focalPoints: any[]): TitleLayout {
    const avoidPoints = focalPoints.slice(0, 3);

    return {
      type: 'artistic',
      alignment: 'organic',
      wordPositions: words.map((word, i) => {
        let x = 50 + (Math.random() - 0.5) * 20;
        let y = 20 + (i * 10);

        avoidPoints.forEach(point => {
          const dist = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
          if (dist < 20) {
            x += (x - point.x) * 0.5;
            y += (y - point.y) * 0.3;
          }
        });

        return {
          x: Math.max(20, Math.min(80, x)),
          y: Math.max(15, Math.min(45, y)),
          rotation: (Math.random() - 0.5) * 5,
          scale: word.length > 5 ? 1.1 : 1.0
        };
      }),
      container: {
        left: '50%',
        top: '30%',
        transform: 'translate(-50%, -50%)'
      }
    };
  }

  selectAppropriateEffects(analysis: CoverAnalysis, genre: string, styleDecision: StyleDecision): SelectedEffects {
    console.log('✨ Selecting appropriate effects...');

    const genreEffects: Record<string, string[]> = {
      fantasy: ['gold-glow', 'metallic', 'cosmic-glow', 'fire-glow'],
      horror: ['long-shadow', 'blood-drip', 'distressed', 'smoke'],
      romance: ['elegant-glow', 'soft-shadow', 'gold-emboss', 'velvet'],
      'science fiction': ['neon-glow', 'cyber-shadow', 'hologram', 'scan-line'],
      scifi: ['neon-glow', 'cyber-shadow', 'hologram', 'scan-line'],
      mystery: ['long-shadow', 'smoke-effect', 'distressed', 'typewriter'],
      children: ['rainbow', 'bounce-effect', 'sparkle', 'cartoon-outline'],
      'self-help': ['elegant-glow', 'soft-shadow', 'gold-leaf', 'clean'],
      business: ['elegant-shadow', 'metallic', 'clean', 'professional'],
      'business & finance': ['elegant-shadow', 'metallic', 'clean', 'professional'],
      psychology: ['soft-glow', 'gradient-texture', 'elegant-shadow'],
      'health & wellness': ['soft-glow', 'nature-tones', 'clean', 'serene'],
      spirituality: ['cosmic-glow', 'gold-leaf', 'ethereal', 'mystical'],
      productivity: ['clean', 'professional', 'elegant-shadow', 'metallic'],
      'historical fiction': ['gold-leaf', 'vintage', 'embossed', 'parchment']
    };

    const effects = genreEffects[genre?.toLowerCase()] || ['elegant-glow', 'soft-shadow'];
    const primaryEffect = effects[Math.floor(Math.random() * effects.length)];
    
    let secondaryEffect = effects.find(e => e !== primaryEffect) || 'soft-shadow';

    const animations = styleDecision.effectIntensity === 'intense' 
      ? ['pulse', 'float', 'glow-pulse']
      : ['fade-in', 'subtle-float'];

    return {
      primary: primaryEffect,
      secondary: secondaryEffect,
      animation: animations[Math.floor(Math.random() * animations.length)]
    };
  }

  generateCSSVariables(colors: PerfectColors, styleDecision: StyleDecision): Record<string, string> {
    return {
      '--title-primary': colors.primary,
      '--title-secondary': colors.secondary,
      '--title-accent': colors.accent,
      '--title-gradient': colors.gradient,
      '--title-shadow': colors.shadow,
      '--title-glow': colors.glow,
      '--complexity': styleDecision.complexityLevel,
      '--layout-type': styleDecision.layoutType
    };
  }

  generateEffectClasses(effects: SelectedEffects, styleDecision: StyleDecision): string[] {
    const classes = [
      `effect-${effects.primary}`,
      `effect-${effects.secondary}`,
      `animation-${effects.animation}`,
      `complexity-${styleDecision.complexityLevel}`,
      `layout-${styleDecision.layoutType}`
    ];

    if (styleDecision.useTwoTone) classes.push('two-tone');
    if (styleDecision.useMultiColor) classes.push('multi-color');
    if (styleDecision.useFirstLetterEmphasis) classes.push('first-letter-emphasis');

    return classes;
  }

  getHue(hexColor: string): number {
    const rgb = this.hexToRgb(hexColor);
    if (!rgb) return 0;

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    if (max === min) return 0;

    let hue = 0;
    const d = max - min;

    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;

    hue /= 6;
    return hue * 360;
  }

  getSaturation(hexColor: string): number {
    const rgb = this.hexToRgb(hexColor);
    if (!rgb) return 0;

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    if (max === 0) return 0;
    return (max - min) / max;
  }

  getBrightness(hexColor: string): number {
    const rgb = this.hexToRgb(hexColor);
    if (!rgb) return 0.5;
    return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  }

  hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  darkenColor(color: string, percent: number): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    const factor = 1 - percent / 100;
    const r = Math.round(rgb.r * factor);
    const g = Math.round(rgb.g * factor);
    const b = Math.round(rgb.b * factor);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  lightenColor(color: string, percent: number): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    const factor = percent / 100;
    const r = Math.round(rgb.r + (255 - rgb.r) * factor);
    const g = Math.round(rgb.g + (255 - rgb.g) * factor);
    const b = Math.round(rgb.b + (255 - rgb.b) * factor);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  getComplementaryColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return '#FFFFFF';

    return `#${(255 - rgb.r).toString(16).padStart(2, '0')}${(255 - rgb.g).toString(16).padStart(2, '0')}${(255 - rgb.b).toString(16).padStart(2, '0')}`;
  }

  calculateColorContrast(color1: string, color2: string): number {
    const b1 = this.getBrightness(color1);
    const b2 = this.getBrightness(color2);
    return Math.abs(b1 - b2);
  }

  getDefaultAnalysis(): CoverAnalysis {
    return {
      dimensions: { width: 600, height: 900 },
      dominantColors: ['#2C1810', '#C4A35A', '#1A1A2E', '#8B4513', '#D4AF37'],
      averageBrightness: 0.4,
      contrastAreas: [],
      emptySpaces: [{ x: 50, y: 25, width: 80, height: 25 }],
      focalPoints: [],
      colorHarmony: 'analogous',
      imageStyle: 'dark-dramatic',
      mood: 'dramatic'
    };
  }

  getDefaultColors(): PerfectColors {
    return {
      primary: '#D4AF37',
      secondary: '#FFFFFF',
      accent: '#FFD700',
      gradient: 'linear-gradient(135deg, #D4AF37 0%, #FFD700 100%)',
      perWord: ['#D4AF37'],
      shadow: 'rgba(0, 0, 0, 0.5)',
      glow: 'rgba(212, 175, 55, 0.4)'
    };
  }

  getFallbackDesign(titleText: string, genre: string): PerfectTitleDesign {
    return {
      colors: this.getDefaultColors(),
      layout: this.createSimpleLayout(titleText.split(' '), { x: 50, y: 30 }),
      effects: { primary: 'elegant-glow', secondary: 'soft-shadow', animation: 'fade-in' },
      styleDecision: {
        complexityLevel: 'simple',
        useTwoTone: false,
        useMultiColor: false,
        useFirstLetterEmphasis: false,
        layoutType: 'simple',
        effectIntensity: 'subtle'
      },
      cssVariables: {},
      effectClasses: ['effect-elegant-glow', 'complexity-simple']
    };
  }
}

export const titlePerfectionEngine = new TitlePerfectionEngine();
