"""
EbookGames AI Cover Generation - Python Reference Code
This shows how the AI generates background images using OpenAI's DALL-E.
Original code is in TypeScript (server/contentStudio.ts)
"""

import openai
import random
import os
import base64
from typing import Tuple


# ============================================================
# CONFIGURATION
# ============================================================

# OpenAI client would be initialized with API key
# openai.api_key = os.environ.get("OPENAI_API_KEY")


# ============================================================
# COLOR SCHEMES - 30 diverse palettes
# ============================================================

COLOR_SCHEMES = [
    "deep burgundy, antique gold, and mahogany brown",
    "midnight blue, silver, and charcoal gray",
    "forest green, bronze, and cream",
    "royal purple, gold leaf, and black",
    "burnt orange, copper, and dark chocolate",
    "teal, rose gold, and ivory",
    "crimson red, black, and gold",
    "sage green, blush pink, and white",
    "navy blue, coral, and sand",
    "emerald green, pearl white, and gold",
    "dusty rose, champagne, and dove gray",
    "cobalt blue, amber, and cream",
    "plum purple, silver, and midnight black",
    "terracotta, olive green, and tan",
    "sapphire blue, gold, and burgundy",
    "lavender, silver, and soft gray",
    "rust orange, teal, and cream",
    "deep teal, copper, and black",
    "mauve pink, gold, and charcoal",
    "hunter green, burgundy, and gold",
    "steel blue, bronze, and ivory",
    "magenta, gold, and black",
    "olive, burnt sienna, and cream",
    "indigo, silver, and white",
    "coral, navy, and gold",
    "charcoal, rose gold, and blush",
    "forest green, gold, and black",
    "peacock blue, copper, and cream",
    "wine red, gold, and ivory",
    "slate gray, gold, and white",
]


# ============================================================
# DESIGN STYLES - 25 artistic approaches
# ============================================================

DESIGN_STYLES = [
    "dark academia aesthetic with vintage library feel",
    "minimalist modern design with bold geometric shapes",
    "art deco style with elegant patterns and lines",
    "watercolor artistic style with soft gradients",
    "vintage botanical illustration style",
    "gothic romantic aesthetic with ornate details",
    "contemporary clean design with gradient backgrounds",
    "classic literary style with embossed texture look",
    "moody atmospheric with dramatic lighting",
    "elegant baroque inspired ornamental design",
    "abstract expressionist with bold brushstrokes",
    "celestial mystical theme with stars and moons",
    "nature-inspired with organic flowing elements",
    "retro vintage 1920s poster style",
    "sophisticated marble and metallic textures",
    "Japanese ukiyo-e inspired woodblock print style",
    "Nordic Scandinavian minimalist with clean lines",
    "steampunk Victorian with gears and mechanical elements",
    "impressionist painting style with soft light",
    "art nouveau with flowing organic curves and borders",
    "surrealist dreamlike imagery with unexpected elements",
    "photorealistic cinematic movie poster style",
    "folk art style with handcrafted rustic charm",
    "neon cyberpunk with glowing accents and city lights",
    "renaissance classical painting aesthetic",
]


# ============================================================
# COMPOSITION STYLES - 20 layout approaches
# ============================================================

COMPOSITION_STYLES = [
    "centered symmetrical composition",
    "dramatic diagonal composition",
    "rule of thirds balanced layout",
    "minimalist negative space focus",
    "layered depth with foreground and background",
    "circular vignette framing",
    "split composition with contrasting halves",
    "golden ratio spiral composition",
    "floating elements with dreamlike arrangement",
    "dramatic close-up focus",
    "panoramic wide view",
    "triangular balanced composition",
    "border frame with central focal point",
    "asymmetrical dynamic balance",
    "radial burst from center",
    "stacked horizontal layers",
    "vertical tower composition",
    "scattered organic arrangement",
    "bold silhouette against gradient",
    "overlapping transparent layers",
]


# ============================================================
# GENRE-SPECIFIC IMAGERY
# ============================================================

IMAGE_ELEMENTS = {
    "Fantasy": [
        "ancient castle on misty mountain",
        "magical forest with glowing runes",
        "dragon silhouette against moon",
        "enchanted sword in stone",
        "mystical portal with swirling energy",
        "wizard tower at twilight",
        "phoenix rising from flames",
        "floating islands in clouds",
        "enchanted crystal cave",
        "mythical creatures in moonlight",
    ],
    "Science Fiction": [
        "futuristic cityscape with flying vehicles",
        "sleek spaceship among stars",
        "alien planet landscape",
        "holographic display interface",
        "cosmic nebula and galaxies",
        "android with human features",
        "wormhole portal opening",
        "space station orbiting planet",
        "bioluminescent alien flora",
        "cyborg enhancement imagery",
    ],
    "Romance": [
        "romantic garden at sunset",
        "sunset beach with silhouettes",
        "elegant ballroom chandelier",
        "intertwined roses and vines",
        "starlit night with lanterns",
        "Parisian cafe scene",
        "heart-shaped elements",
        "couple silhouette under umbrella",
        "vintage love letters",
        "wedding-inspired florals",
    ],
    "Horror": [
        "haunted Victorian mansion",
        "misty graveyard with tombstones",
        "mysterious shadows in doorway",
        "eerie blood moon",
        "twisted dead trees",
        "creepy doll face",
        "abandoned asylum corridor",
        "spectral figure in mist",
        "old cursed mirror",
        "dark forest path",
    ],
    "Mystery / Thriller": [
        "detective magnifying glass over clues",
        "foggy London street at night",
        "old skeleton key",
        "mysterious doorway with light",
        "shadowy figure in trench coat",
        "crime scene evidence",
        "coded message papers",
        "noir city alley",
        "pocket watch and dagger",
        "fingerprint patterns",
    ],
    "Self-Help / Personal Development": [
        "mountain summit with sunrise",
        "rising sun over horizon",
        "open pathway through forest",
        "growing tree from acorn",
        "compass pointing north",
        "butterfly transformation",
        "ladder reaching clouds",
        "puzzle pieces coming together",
        "blooming flower time-lapse",
        "person meditating at peak",
    ],
    "Business / Entrepreneurship": [
        "modern city skyline",
        "ascending bar graph",
        "golden clockwork gears",
        "handshake silhouette",
        "strategic chess pieces",
        "rocket launching",
        "network connections",
        "golden key to success",
        "skyscraper reflection",
        "boardroom with city view",
    ],
    "default": [
        "elegant feather quill",
        "antique stacked books",
        "ornate golden frame",
        "flowing silk ribbon",
        "classical marble columns",
        "vintage typewriter",
        "leather bound journal",
        "candlelight ambiance",
        "academic study scene",
        "artistic paint palette",
    ],
}


# ============================================================
# MAIN FUNCTION - Generate AI Cover Background
# ============================================================

def generate_cover_image(title: str, genre: str, draft_id: int = 0) -> Tuple[str, str]:
    """
    Generate an AI cover image using OpenAI's DALL-E.
    
    IMPORTANT: The prompt includes "No text, letters, or words on the image"
    but AI often ignores this and embeds text anyway.
    
    Args:
        title: The book title (used in prompt for context)
        genre: The book's genre (determines imagery)
        draft_id: Unique ID for the book
    
    Returns:
        Tuple of (cover_url, background_url) - file paths to saved images
    """
    
    # Randomly select style elements
    color_scheme = random.choice(COLOR_SCHEMES)
    design_style = random.choice(DESIGN_STYLES)
    composition_style = random.choice(COMPOSITION_STYLES)
    
    # Find genre-specific imagery
    genre_key = None
    for key in IMAGE_ELEMENTS.keys():
        if genre.lower() in key.lower() or key.lower() in genre.lower():
            genre_key = key
            break
    
    if genre_key is None:
        genre_key = "default"
    
    genre_elements = IMAGE_ELEMENTS[genre_key]
    selected_element = random.choice(genre_elements)
    
    # ========================================
    # BUILD THE PROMPT
    # ========================================
    
    # This is the key prompt sent to DALL-E
    # Note: "No text, letters, or words" is often IGNORED by the AI
    prompt = f'''Professional ebook cover design for "{title}" - a {genre} book. 
Style: {design_style}. 
Layout: {composition_style}. 
Color palette: {color_scheme}. 
Feature {selected_element} as central imagery. 
Sophisticated, premium quality, artistic composition suitable for bestselling book cover. 
No text, letters, or words on the image.'''
    
    print(f"Generating cover with prompt:")
    print(f"  Title: {title}")
    print(f"  Genre: {genre}")
    print(f"  Design: {design_style}")
    print(f"  Colors: {color_scheme}")
    print(f"  Element: {selected_element}")
    
    # ========================================
    # CALL OPENAI API
    # ========================================
    
    # This would make the actual API call:
    # response = openai.images.generate(
    #     model="gpt-image-1",  # or "dall-e-3"
    #     prompt=prompt,
    #     n=1,
    #     size="1024x1024",
    # )
    # 
    # image_data = response.data[0].b64_json
    # background_buffer = base64.b64decode(image_data)
    
    # For this reference, we'll just show what would happen:
    print("\n[Would call OpenAI API here to generate image]")
    print(f"Prompt: {prompt[:100]}...")
    
    # ========================================
    # SAVE THE IMAGE
    # ========================================
    
    # After getting the image from OpenAI:
    # 1. Save the raw background (without text)
    # 2. Add text overlay using add_text_overlay_to_cover()
    # 3. Save the final cover (with text)
    
    timestamp = 1234567890  # Would be actual timestamp
    
    background_url = f"/uploads/covers/ai-bg-{timestamp}.png"
    cover_url = f"/uploads/covers/ai-cover-{timestamp}.png"
    
    return cover_url, background_url


# ============================================================
# THE PROBLEM: AI IGNORES "NO TEXT" INSTRUCTION
# ============================================================

"""
KNOWN ISSUE:

Even though the prompt explicitly says:
    "No text, letters, or words on the image"

AI image generators like DALL-E often IGNORE this instruction and still
generate text-like patterns, random letters, or garbled words embedded
directly into the image.

This is a fundamental limitation of current AI image generation.

The result:
- Background image has AI-generated gibberish text baked in
- Our code then adds the REAL title/author on top
- Final cover has DOUBLE TEXT: 
    1. Unwanted AI text (random/garbled)
    2. Our overlay text (correct title/author)

Solutions:
1. Regenerate images multiple times until one has no text
2. Use inpainting to remove text areas
3. Use a different AI model that better follows "no text" instructions
4. Manually edit covers to remove AI text
"""


# ============================================================
# EXAMPLE USAGE
# ============================================================

if __name__ == "__main__":
    print("AI Cover Generation - Python Reference")
    print("=" * 50)
    print()
    
    # Demonstrate the prompt generation
    cover_url, bg_url = generate_cover_image(
        title="The Secrets of Machine Learning",
        genre="Technology",
        draft_id=42
    )
    
    print()
    print(f"Would save background to: {bg_url}")
    print(f"Would save final cover to: {cover_url}")
