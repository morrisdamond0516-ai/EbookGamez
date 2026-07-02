/**
 * Cover Image Analyzer
 * Analyzes actual ebook cover images to extract colors, empty areas, and focal points
 * for intelligent title placement and color decisions
 */

interface ColorInfo {
  hex: string;
  rgb: [number, number, number];
  brightness: number;
}

interface EmptyArea {
  x: number;
  y: number;
  width: number;
  height: number;
  complexity: number;
}

interface FocalPoint {
  x: number;
  y: number;
  strength: number;
}

interface OptimalPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  position: 'top' | 'center' | 'bottom';
  score: number;
}

interface OptimalColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  contrastWithBackground: 'light' | 'dark';
}

export interface CoverAnalysis {
  dominantColors: string[];
  accentColors: string[];
  colorHarmony: string;
  emptyAreas: EmptyArea[];
  focalPoints: FocalPoint[];
  optimalPlacement: OptimalPlacement;
  optimalColors: OptimalColors;
  imageStyle: 'cinematic' | 'painterly' | 'minimal' | 'photographic' | 'abstract';
  mood: string;
  brightnessLevels: { overall: number; top: number; center: number; bottom: number };
  contrastScore: number;
}

export class CoverImageAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private width: number = 0;
  private height: number = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  async analyzeCover(imageUrl: string, titleText: string, genre: string): Promise<CoverAnalysis> {
    const image = await this.loadImage(imageUrl);
    
    this.width = image.width;
    this.height = image.height;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.drawImage(image, 0, 0);
    
    this.imageData = this.ctx.getImageData(0, 0, this.width, this.height);
    
    const dominantColors = this.extractDominantColors(5);
    const accentColors = this.findAccentColors(dominantColors);
    const emptyAreas = this.findEmptyAreas();
    const focalPoints = this.detectFocalPoints();
    const brightnessLevels = this.measureBrightness();
    const contrastScore = this.calculateContrastScore();
    const optimalPlacement = this.calculateOptimalPlacement(titleText, emptyAreas, focalPoints);
    const optimalColors = this.calculateOptimalColors(optimalPlacement, dominantColors, accentColors);
    const imageStyle = this.determineImageStyle(contrastScore, dominantColors);
    const mood = this.analyzeMood(brightnessLevels, dominantColors, genre);
    const colorHarmony = this.analyzeColorHarmony(dominantColors);

    return {
      dominantColors,
      accentColors,
      colorHarmony,
      emptyAreas,
      focalPoints,
      optimalPlacement,
      optimalColors,
      imageStyle,
      mood,
      brightnessLevels,
      contrastScore
    };
  }

  private extractDominantColors(numColors: number = 5): string[] {
    if (!this.imageData) return ['#000000'];
    
    const pixels = this.imageData.data;
    const colorCounts: Record<string, number> = {};
    
    for (let i = 0; i < pixels.length; i += 40) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      
      const quantizedR = Math.floor(r / 32) * 32;
      const quantizedG = Math.floor(g / 32) * 32;
      const quantizedB = Math.floor(b / 32) * 32;
      
      const colorKey = `${quantizedR},${quantizedG},${quantizedB}`;
      colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
    }
    
    const sortedColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, numColors)
      .map(([colorKey]) => {
        const [r, g, b] = colorKey.split(',').map(Number);
        return this.rgbToHex(r, g, b);
      });
    
    return sortedColors.length > 0 ? sortedColors : ['#000000'];
  }

  private findAccentColors(dominantColors: string[]): string[] {
    const brightnessValues = dominantColors.map(color => {
      const rgb = this.hexToRgb(color);
      return this.getBrightness(rgb);
    });
    
    const brightestIndex = brightnessValues.indexOf(Math.max(...brightnessValues));
    const darkestIndex = brightnessValues.indexOf(Math.min(...brightnessValues));
    
    const accentColor = dominantColors[brightestIndex] || dominantColors[0];
    const complementary = this.getComplementaryColor(accentColor);
    
    return [accentColor, complementary, dominantColors[darkestIndex] || dominantColors[0]];
  }

  private findEmptyAreas(): EmptyArea[] {
    const gridSize = 8;
    const emptyAreas: EmptyArea[] = [];
    
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const x = Math.floor((gx / gridSize) * this.width);
        const y = Math.floor((gy / gridSize) * this.height);
        const cellWidth = Math.floor(this.width / gridSize);
        const cellHeight = Math.floor(this.height / gridSize);
        
        const complexity = this.measureAreaComplexity(x, y, cellWidth, cellHeight);
        
        if (complexity < 0.35) {
          emptyAreas.push({
            x: (gx / gridSize) * 100,
            y: (gy / gridSize) * 100,
            width: 100 / gridSize,
            height: 100 / gridSize,
            complexity
          });
        }
      }
    }
    
    return this.groupEmptyAreas(emptyAreas);
  }

  private measureAreaComplexity(x: number, y: number, width: number, height: number): number {
    if (!this.imageData) return 1;
    
    let totalVariation = 0;
    let samples = 0;
    
    for (let py = y; py < y + height && py < this.height; py += 5) {
      for (let px = x; px < x + width && px < this.width; px += 5) {
        const index = (py * this.width + px) * 4;
        const r1 = this.imageData.data[index];
        const g1 = this.imageData.data[index + 1];
        const b1 = this.imageData.data[index + 2];
        
        if (px + 5 < this.width) {
          const nextIndex = (py * this.width + (px + 5)) * 4;
          const r2 = this.imageData.data[nextIndex];
          const g2 = this.imageData.data[nextIndex + 1];
          const b2 = this.imageData.data[nextIndex + 2];
          
          const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
          totalVariation += diff;
          samples++;
        }
      }
    }
    
    return samples > 0 ? totalVariation / (samples * 765) : 0;
  }

  private groupEmptyAreas(areas: EmptyArea[]): EmptyArea[] {
    if (areas.length === 0) return [];
    
    const grouped: EmptyArea[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < areas.length; i++) {
      if (used.has(i)) continue;
      
      let group = { ...areas[i] };
      used.add(i);
      
      for (let j = i + 1; j < areas.length; j++) {
        if (used.has(j)) continue;
        
        const adjacent = 
          (Math.abs(areas[j].x - (group.x + group.width)) < 1 && Math.abs(areas[j].y - group.y) < group.height) ||
          (Math.abs(areas[j].y - (group.y + group.height)) < 1 && Math.abs(areas[j].x - group.x) < group.width);
        
        if (adjacent) {
          group = {
            x: Math.min(group.x, areas[j].x),
            y: Math.min(group.y, areas[j].y),
            width: Math.max(group.x + group.width, areas[j].x + areas[j].width) - Math.min(group.x, areas[j].x),
            height: Math.max(group.y + group.height, areas[j].y + areas[j].height) - Math.min(group.y, areas[j].y),
            complexity: (group.complexity + areas[j].complexity) / 2
          };
          used.add(j);
        }
      }
      
      grouped.push(group);
    }
    
    return grouped.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  }

  private detectFocalPoints(): FocalPoint[] {
    if (!this.imageData) return [];
    
    const focalPoints: FocalPoint[] = [];
    const stepSize = 20;
    
    for (let y = stepSize; y < this.height - stepSize; y += stepSize) {
      for (let x = stepSize; x < this.width - stepSize; x += stepSize) {
        const edgeDensity = this.getEdgeDensity(x, y, stepSize);
        
        if (edgeDensity > 0.6) {
          focalPoints.push({
            x: (x / this.width) * 100,
            y: (y / this.height) * 100,
            strength: edgeDensity
          });
        }
      }
    }
    
    return focalPoints.sort((a, b) => b.strength - a.strength).slice(0, 10);
  }

  private getEdgeDensity(cx: number, cy: number, size: number): number {
    if (!this.imageData) return 0;
    
    let edgeSum = 0;
    let samples = 0;
    
    for (let y = cy - size/2; y < cy + size/2 && y < this.height - 1; y += 3) {
      for (let x = cx - size/2; x < cx + size/2 && x < this.width - 1; x += 3) {
        if (x < 0 || y < 0) continue;
        
        const idx = (Math.floor(y) * this.width + Math.floor(x)) * 4;
        const idxRight = idx + 4;
        const idxDown = idx + this.width * 4;
        
        const gx = Math.abs(this.imageData.data[idx] - this.imageData.data[idxRight]);
        const gy = Math.abs(this.imageData.data[idx] - this.imageData.data[idxDown]);
        
        edgeSum += (gx + gy) / 510;
        samples++;
      }
    }
    
    return samples > 0 ? edgeSum / samples : 0;
  }

  private calculateOptimalPlacement(titleText: string, emptyAreas: EmptyArea[], focalPoints: FocalPoint[]): OptimalPlacement {
    const preferredPositions: OptimalPlacement[] = [
      { x: 10, y: 5, width: 80, height: 25, position: 'top', score: 0 },
      { x: 10, y: 40, width: 80, height: 20, position: 'center', score: 0 },
      { x: 10, y: 75, width: 80, height: 20, position: 'bottom', score: 0 }
    ];
    
    for (const placement of preferredPositions) {
      let score = 50;
      
      if (placement.position === 'top') score += 20;
      
      for (const empty of emptyAreas) {
        const overlap = this.calculateOverlap(placement, empty);
        score += overlap * 30;
      }
      
      for (const focal of focalPoints) {
        if (focal.x >= placement.x && focal.x <= placement.x + placement.width &&
            focal.y >= placement.y && focal.y <= placement.y + placement.height) {
          score -= focal.strength * 40;
        }
      }
      
      placement.score = score;
    }
    
    preferredPositions.sort((a, b) => b.score - a.score);
    return preferredPositions[0];
  }

  private calculateOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
    const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const overlapArea = xOverlap * yOverlap;
    const aArea = a.width * a.height;
    return aArea > 0 ? overlapArea / aArea : 0;
  }

  private calculateOptimalColors(placement: OptimalPlacement, dominantColors: string[], accentColors: string[]): OptimalColors {
    const areaColors = this.getColorsFromArea(placement);
    const avgBrightness = areaColors.reduce((sum, c) => sum + c.brightness, 0) / Math.max(areaColors.length, 1);
    const contrastWithBackground: 'light' | 'dark' = avgBrightness > 128 ? 'dark' : 'light';
    
    let primary: string;
    let secondary: string;
    
    if (contrastWithBackground === 'light') {
      primary = '#FFFFFF';
      secondary = accentColors[0] || '#F5F5F5';
    } else {
      primary = '#1A1A1A';
      secondary = dominantColors[1] || '#333333';
    }
    
    const vibrantColors = dominantColors.filter(c => {
      const rgb = this.hexToRgb(c);
      const max = Math.max(...rgb);
      const min = Math.min(...rgb);
      return (max - min) > 50;
    });
    
    const accent = vibrantColors[0] || accentColors[0] || dominantColors[0];
    
    return {
      primary,
      secondary,
      accent,
      background: dominantColors[0],
      contrastWithBackground
    };
  }

  private getColorsFromArea(area: { x: number; y: number; width: number; height: number }): ColorInfo[] {
    if (!this.imageData) return [];
    
    const colors: ColorInfo[] = [];
    const startX = Math.floor((area.x / 100) * this.width);
    const startY = Math.floor((area.y / 100) * this.height);
    const endX = Math.floor(((area.x + area.width) / 100) * this.width);
    const endY = Math.floor(((area.y + area.height) / 100) * this.height);
    
    for (let y = startY; y < endY; y += 10) {
      for (let x = startX; x < endX; x += 10) {
        const idx = (y * this.width + x) * 4;
        const r = this.imageData.data[idx];
        const g = this.imageData.data[idx + 1];
        const b = this.imageData.data[idx + 2];
        
        colors.push({
          hex: this.rgbToHex(r, g, b),
          rgb: [r, g, b],
          brightness: this.getBrightness([r, g, b])
        });
      }
    }
    
    return colors;
  }

  private measureBrightness(): { overall: number; top: number; center: number; bottom: number } {
    if (!this.imageData) return { overall: 128, top: 128, center: 128, bottom: 128 };
    
    const measureRegion = (startY: number, endY: number): number => {
      let sum = 0;
      let count = 0;
      
      for (let y = startY; y < endY; y += 5) {
        for (let x = 0; x < this.width; x += 5) {
          const idx = (y * this.width + x) * 4;
          const brightness = this.getBrightness([
            this.imageData!.data[idx],
            this.imageData!.data[idx + 1],
            this.imageData!.data[idx + 2]
          ]);
          sum += brightness;
          count++;
        }
      }
      
      return count > 0 ? sum / count : 128;
    };
    
    const thirdHeight = Math.floor(this.height / 3);
    
    return {
      overall: measureRegion(0, this.height),
      top: measureRegion(0, thirdHeight),
      center: measureRegion(thirdHeight, thirdHeight * 2),
      bottom: measureRegion(thirdHeight * 2, this.height)
    };
  }

  private calculateContrastScore(): number {
    if (!this.imageData) return 0.5;
    
    let minBrightness = 255;
    let maxBrightness = 0;
    
    for (let i = 0; i < this.imageData.data.length; i += 40) {
      const brightness = this.getBrightness([
        this.imageData.data[i],
        this.imageData.data[i + 1],
        this.imageData.data[i + 2]
      ]);
      
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
    }
    
    return (maxBrightness - minBrightness) / 255;
  }

  private determineImageStyle(contrastScore: number, dominantColors: string[]): 'cinematic' | 'painterly' | 'minimal' | 'photographic' | 'abstract' {
    const colorVariety = new Set(dominantColors).size;
    
    if (contrastScore > 0.7 && colorVariety >= 4) return 'cinematic';
    if (contrastScore < 0.4 && colorVariety <= 3) return 'minimal';
    if (colorVariety >= 5) return 'painterly';
    if (contrastScore > 0.5) return 'photographic';
    return 'abstract';
  }

  private analyzeMood(brightness: { overall: number; top: number; center: number; bottom: number }, dominantColors: string[], genre: string): string {
    const avgBrightness = brightness.overall;
    
    const warmColors = dominantColors.filter(c => {
      const rgb = this.hexToRgb(c);
      return rgb[0] > rgb[2];
    }).length;
    
    const coolColors = dominantColors.length - warmColors;
    
    let mood = '';
    
    if (avgBrightness < 80) {
      mood = warmColors > coolColors ? 'dark-dramatic' : 'mysterious';
    } else if (avgBrightness > 180) {
      mood = warmColors > coolColors ? 'warm-hopeful' : 'ethereal';
    } else {
      mood = warmColors > coolColors ? 'intense' : 'calm';
    }
    
    const genreMoodBoost: Record<string, string> = {
      'horror': 'dark',
      'romance': 'romantic',
      'fantasy': 'epic',
      'scifi': 'futuristic',
      'mystery': 'mysterious',
      'thriller': 'intense'
    };
    
    const genreKey = Object.keys(genreMoodBoost).find(g => genre.toLowerCase().includes(g));
    if (genreKey) {
      mood = `${genreMoodBoost[genreKey]}-${mood}`;
    }
    
    return mood;
  }

  private analyzeColorHarmony(dominantColors: string[]): string {
    if (dominantColors.length < 2) return 'monochromatic';
    
    const hues = dominantColors.map(c => {
      const rgb = this.hexToRgb(c);
      return this.rgbToHsl(rgb)[0];
    });
    
    const hueDiffs = [];
    for (let i = 0; i < hues.length - 1; i++) {
      hueDiffs.push(Math.abs(hues[i] - hues[i + 1]));
    }
    
    const avgDiff = hueDiffs.reduce((a, b) => a + b, 0) / hueDiffs.length;
    
    if (avgDiff < 30) return 'analogous';
    if (avgDiff > 150 && avgDiff < 210) return 'complementary';
    if (avgDiff > 100 && avgDiff < 140) return 'triadic';
    return 'diverse';
  }

  private rgbToHsl(rgb: [number, number, number]): [number, number, number] {
    const r = rgb[0] / 255;
    const g = rgb[1] / 255;
    const b = rgb[2] / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return [h * 360, s * 100, l * 100];
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  }

  private getBrightness(rgb: [number, number, number]): number {
    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  }

  private getComplementaryColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    return this.rgbToHex(255 - rgb[0], 255 - rgb[1], 255 - rgb[2]);
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }
}
