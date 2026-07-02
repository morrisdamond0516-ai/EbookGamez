// effects-library.ts
// Organized library of 20+ typography effects with genre/mood mapping

export interface TypographyEffect {
  id: string;
  name: string;
  category: 'glow' | 'shadow' | 'texture' | 'special' | 'animation';
  cssClass: string;
  cssProperties?: Record<string, string>;
  suitable: {
    genres: string[];
    moods: string[];
    complexity: ('simple' | 'moderate' | 'complex')[];
  };
}

export const EFFECTS_LIBRARY: TypographyEffect[] = [
  // GLOW EFFECTS
  {
    id: 'elegant-glow',
    name: 'Elegant Glow',
    category: 'glow',
    cssClass: 'effect-elegant-glow',
    suitable: {
      genres: ['romance', 'literary', 'poetry', 'drama'],
      moods: ['romantic', 'elegant', 'sophisticated', 'warm'],
      complexity: ['simple', 'moderate']
    }
  },
  {
    id: 'soft-glow',
    name: 'Soft Glow',
    category: 'glow',
    cssClass: 'effect-soft-glow',
    suitable: {
      genres: ['romance', 'self-help', 'spirituality', 'wellness'],
      moods: ['calm', 'peaceful', 'warm', 'gentle'],
      complexity: ['simple']
    }
  },
  {
    id: 'gold-glow',
    name: 'Gold Glow',
    category: 'glow',
    cssClass: 'effect-gold-glow',
    suitable: {
      genres: ['fantasy', 'historical', 'luxury', 'business'],
      moods: ['premium', 'luxurious', 'epic', 'warm'],
      complexity: ['moderate', 'complex']
    }
  },
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    category: 'glow',
    cssClass: 'effect-neon-glow',
    suitable: {
      genres: ['scifi', 'thriller', 'cyberpunk', 'tech'],
      moods: ['futuristic', 'electric', 'intense', 'modern'],
      complexity: ['moderate', 'complex']
    }
  },
  {
    id: 'cosmic-glow',
    name: 'Cosmic Glow',
    category: 'glow',
    cssClass: 'effect-cosmic-glow',
    suitable: {
      genres: ['scifi', 'fantasy', 'space', 'supernatural'],
      moods: ['mystical', 'epic', 'cosmic', 'mysterious'],
      complexity: ['complex']
    }
  },
  {
    id: 'fire-glow',
    name: 'Fire Glow',
    category: 'glow',
    cssClass: 'effect-fire-glow',
    suitable: {
      genres: ['fantasy', 'action', 'adventure', 'horror'],
      moods: ['intense', 'dramatic', 'passionate', 'dangerous'],
      complexity: ['moderate', 'complex']
    }
  },
  
  // SHADOW EFFECTS
  {
    id: 'soft-shadow',
    name: 'Soft Shadow',
    category: 'shadow',
    cssClass: 'effect-soft-shadow',
    suitable: {
      genres: ['literary', 'drama', 'romance', 'memoir'],
      moods: ['subtle', 'elegant', 'classic', 'understated'],
      complexity: ['simple']
    }
  },
  {
    id: 'hard-shadow',
    name: 'Hard Shadow',
    category: 'shadow',
    cssClass: 'effect-hard-shadow',
    suitable: {
      genres: ['thriller', 'mystery', 'noir', 'crime'],
      moods: ['bold', 'dramatic', 'intense', 'dark'],
      complexity: ['simple', 'moderate']
    }
  },
  {
    id: 'long-shadow',
    name: 'Long Shadow',
    category: 'shadow',
    cssClass: 'effect-long-shadow',
    suitable: {
      genres: ['retro', 'vintage', 'design', 'modern'],
      moods: ['stylish', 'modern', 'graphic', 'trendy'],
      complexity: ['moderate']
    }
  },
  {
    id: 'floating-shadow',
    name: 'Floating Shadow',
    category: 'shadow',
    cssClass: 'effect-floating-shadow',
    suitable: {
      genres: ['fantasy', 'scifi', 'supernatural', 'mystery'],
      moods: ['ethereal', 'mystical', 'floating', 'dreamlike'],
      complexity: ['moderate', 'complex']
    }
  },
  {
    id: 'perspective-shadow',
    name: 'Perspective Shadow',
    category: 'shadow',
    cssClass: 'effect-perspective-shadow',
    suitable: {
      genres: ['action', 'adventure', 'thriller', 'sports'],
      moods: ['dynamic', 'energetic', '3d', 'dramatic'],
      complexity: ['moderate', 'complex']
    }
  },
  
  // TEXTURE EFFECTS
  {
    id: 'gold-leaf',
    name: 'Gold Leaf',
    category: 'texture',
    cssClass: 'effect-gold-leaf',
    suitable: {
      genres: ['fantasy', 'historical', 'luxury', 'royal'],
      moods: ['premium', 'luxurious', 'elegant', 'regal'],
      complexity: ['complex']
    }
  },
  {
    id: 'velvet',
    name: 'Velvet Texture',
    category: 'texture',
    cssClass: 'effect-velvet',
    suitable: {
      genres: ['romance', 'drama', 'literary', 'erotica'],
      moods: ['sensual', 'rich', 'luxurious', 'romantic'],
      complexity: ['moderate', 'complex']
    }
  },
  {
    id: 'metal',
    name: 'Metal Texture',
    category: 'texture',
    cssClass: 'effect-metal',
    suitable: {
      genres: ['scifi', 'tech', 'industrial', 'action'],
      moods: ['futuristic', 'strong', 'industrial', 'cold'],
      complexity: ['moderate', 'complex']
    }
  },
  {
    id: 'crystal',
    name: 'Crystal',
    category: 'texture',
    cssClass: 'effect-crystal',
    suitable: {
      genres: ['fantasy', 'romance', 'supernatural', 'magical'],
      moods: ['magical', 'sparkling', 'ethereal', 'pure'],
      complexity: ['complex']
    }
  },
  
  // SPECIAL EFFECTS
  {
    id: '3d-extrude',
    name: '3D Extrude',
    category: 'special',
    cssClass: 'effect-3d-extrude',
    suitable: {
      genres: ['children', 'comics', 'action', 'adventure'],
      moods: ['playful', 'bold', 'dynamic', 'fun'],
      complexity: ['moderate', 'complex']
    }
  },
  {
    id: 'liquid',
    name: 'Liquid Effect',
    category: 'special',
    cssClass: 'effect-liquid',
    suitable: {
      genres: ['fantasy', 'supernatural', 'horror', 'artistic'],
      moods: ['fluid', 'mysterious', 'organic', 'artistic'],
      complexity: ['complex']
    }
  },
  {
    id: 'sparkle',
    name: 'Sparkle',
    category: 'special',
    cssClass: 'effect-sparkle',
    suitable: {
      genres: ['romance', 'children', 'fantasy', 'magical'],
      moods: ['magical', 'joyful', 'festive', 'enchanting'],
      complexity: ['moderate', 'complex']
    }
  },
  {
    id: 'rainbow',
    name: 'Rainbow',
    category: 'special',
    cssClass: 'effect-rainbow',
    suitable: {
      genres: ['children', 'lgbtq', 'inspiration', 'art'],
      moods: ['colorful', 'joyful', 'diverse', 'celebratory'],
      complexity: ['complex']
    }
  },
  {
    id: 'two-tone',
    name: 'Two-Tone',
    category: 'special',
    cssClass: 'effect-two-tone',
    suitable: {
      genres: ['modern', 'design', 'business', 'tech'],
      moods: ['modern', 'stylish', 'trendy', 'professional'],
      complexity: ['moderate']
    }
  }
];

// Get effects suitable for a genre
export function getEffectsForGenre(genre: string): TypographyEffect[] {
  const genreLower = genre.toLowerCase();
  return EFFECTS_LIBRARY.filter(effect =>
    effect.suitable.genres.some(g => genreLower.includes(g) || g.includes(genreLower))
  );
}

// Get effects suitable for a mood
export function getEffectsForMood(mood: string): TypographyEffect[] {
  const moodLower = mood.toLowerCase();
  return EFFECTS_LIBRARY.filter(effect =>
    effect.suitable.moods.some(m => moodLower.includes(m) || m.includes(moodLower))
  );
}

// Get effects for complexity level
export function getEffectsForComplexity(complexity: 'simple' | 'moderate' | 'complex'): TypographyEffect[] {
  return EFFECTS_LIBRARY.filter(effect =>
    effect.suitable.complexity.includes(complexity)
  );
}

// Recommend effects based on all factors
export function recommendEffects(
  genre: string,
  mood: string,
  complexity: 'simple' | 'moderate' | 'complex',
  limit: number = 5
): TypographyEffect[] {
  const genreEffects = getEffectsForGenre(genre);
  const moodEffects = getEffectsForMood(mood);
  const complexityEffects = getEffectsForComplexity(complexity);
  
  // Score each effect
  const scored = EFFECTS_LIBRARY.map(effect => {
    let score = 0;
    if (genreEffects.includes(effect)) score += 3;
    if (moodEffects.includes(effect)) score += 2;
    if (complexityEffects.includes(effect)) score += 1;
    return { effect, score };
  });
  
  // Sort by score and return top matches
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.effect);
}

// Get a random effect to break "shimmer addiction"
export function getAlternativeEffect(currentEffect: string, genre: string): TypographyEffect {
  const genreEffects = getEffectsForGenre(genre);
  const alternatives = genreEffects.filter(e => e.id !== currentEffect);
  
  if (alternatives.length === 0) {
    // Fallback to a random safe effect
    const safeEffects = EFFECTS_LIBRARY.filter(e => 
      ['elegant-glow', 'soft-shadow', 'soft-glow'].includes(e.id)
    );
    return safeEffects[Math.floor(Math.random() * safeEffects.length)];
  }
  
  return alternatives[Math.floor(Math.random() * alternatives.length)];
}

// Two-tone style generator
export interface TwoToneStyle {
  type: 'vertical' | 'horizontal' | 'diagonal';
  gradient: string;
  primaryColor: string;
  secondaryColor: string;
}

export function generateTwoToneStyle(
  primaryColor: string,
  secondaryColor: string,
  type: 'vertical' | 'horizontal' | 'diagonal' = 'vertical'
): TwoToneStyle {
  const gradients = {
    vertical: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} 50%, ${secondaryColor} 51%, ${secondaryColor} 100%)`,
    horizontal: `linear-gradient(to bottom, ${primaryColor} 0%, ${primaryColor} 50%, ${secondaryColor} 51%, ${secondaryColor} 100%)`,
    diagonal: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor} 50%, ${secondaryColor} 51%, ${secondaryColor} 100%)`
  };
  
  return {
    type,
    gradient: gradients[type],
    primaryColor,
    secondaryColor
  };
}

// First letter emphasis detector
export function shouldEmphasizeFirstLetter(title: string): boolean {
  const words = title.split(' ');
  const firstWord = words[0].toLowerCase();
  
  // Emphasize if starts with "The" or "A"
  if (['the', 'a', 'an'].includes(firstWord)) return true;
  
  // Emphasize if single word title
  if (words.length === 1) return true;
  
  // Emphasize if first word is very long
  if (words[0].length >= 8) return true;
  
  return false;
}

// Layout position generators
export interface WordPosition {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export function generateCurvedPositions(words: string[]): WordPosition[] {
  if (words.length === 1) {
    return [{ x: 50, y: 50, rotation: 0, scale: 1 }];
  }
  
  const radius = Math.min(40, words.length * 8);
  const startAngle = -Math.PI / 6;
  const angleStep = (Math.PI / 3) / Math.max(words.length - 1, 1);
  
  return words.map((_, i) => {
    const angle = startAngle + (angleStep * i);
    return {
      x: 50 + Math.cos(angle) * radius,
      y: 40 + Math.sin(angle) * radius * 0.5,
      rotation: (angle * 180 / Math.PI) * 0.3, // Subtle rotation
      scale: 1.0 - (Math.abs(i - words.length / 2) * 0.03)
    };
  });
}

export function generateStaggeredPositions(words: string[]): WordPosition[] {
  return words.map((_, i) => ({
    x: 35 + (i % 2 === 0 ? 0 : 15),
    y: 25 + i * 14,
    rotation: i % 2 === 0 ? -2 : 2,
    scale: 1.0
  }));
}

export function generateArtisticPositions(words: string[]): WordPosition[] {
  // Create a more dynamic arrangement based on word count
  const positions: WordPosition[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const isImportant = words[i].length > 4; // Longer words are more important
    positions.push({
      x: 30 + Math.sin(i * 1.5) * 20 + (isImportant ? 5 : 0),
      y: 20 + i * 12 + Math.cos(i) * 3,
      rotation: Math.sin(i * 0.8) * 5,
      scale: isImportant ? 1.1 : 0.95
    });
  }
  
  return positions;
}
