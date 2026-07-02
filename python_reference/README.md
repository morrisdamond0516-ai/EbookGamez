# EbookGames Cover Generation - Python Reference Code

This folder contains Python translations of the cover generation logic for easier understanding.
The actual application uses TypeScript/JavaScript, but this Python code shows the same logic.

## Files

### 1. `cover_text_overlay.py`
The main function that adds title and author text to cover images.

**Key concepts:**
- Loads the background image using PIL (Pillow)
- Samples colors from the title region to choose contrasting text colors
- Wraps long titles into multiple lines
- Draws text with outline/stroke for visibility
- Positions title based on random style selection

### 2. `ai_cover_generation.py`
Shows how AI generates the background images using OpenAI's DALL-E.

**Key concepts:**
- Builds a detailed prompt with color schemes, design styles, and genre elements
- Includes "No text, letters, or words" instruction (often ignored by AI)
- Explains the double-text problem

## The Double-Text Problem

Many covers have TWO layers of text:

1. **AI-Embedded Text** (uncontrollable)
   - DALL-E often ignores the "no text" instruction
   - Generates random letters, words, or text-like patterns
   - This is BAKED INTO the image pixels
   
2. **Overlay Text** (from our code)
   - Title in elegant script font
   - Author name "by EbookGames"
   - Drawn on top using canvas/PIL

**Result:** The final cover may show garbled AI text behind the proper title.

## How Colors Are Chosen

```
1. Sample pixels from where title will appear (top 40% of image)
2. Calculate median brightness of that region
3. If region is DARK → use LIGHT text + dark outline
4. If region is LIGHT → use DARK text + light outline
```

This ensures text is always readable against its actual background.

## How Styles Are Generated

Each book gets a unique style based on its ID (used as random seed):

- **Font**: One of 6 script fonts (Great Vibes, Pacifico, etc.)
- **Layout**: Top-center, center, top-left, or bottom-center
- **Text Effect**: Glow, emboss, outline, shadow, or none
- **Decorative**: Ornate lines, simple, elegant, modern, or none
- **Title Case**: UPPERCASE, Title Case, or Original

## Requirements (if you want to run this code)

```bash
pip install Pillow openai
```

## Original TypeScript Location

The actual production code is in:
- `server/contentStudio.ts` - Main file with all generation logic
