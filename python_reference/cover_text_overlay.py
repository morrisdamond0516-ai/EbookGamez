"""
EbookGames Cover Text Overlay - Python Reference Code
This is a Python translation of the cover generation logic for easier reading.
Original code is in TypeScript (server/contentStudio.ts)
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random
import os
from io import BytesIO
from typing import Tuple, List, Dict, Optional
from dataclasses import dataclass
from enum import Enum


# ============================================================
# CONFIGURATION - Script Fonts for Titles
# ============================================================

SCRIPT_FONT_OPTIONS = [
    {"file": "GreatVibes-Regular.ttf", "family": "Great Vibes"},
    {"file": "Pacifico-Regular.ttf", "family": "Pacifico"},
    {"file": "Tangerine-Bold.ttf", "family": "Tangerine"},
    {"file": "Allura-Regular.ttf", "family": "Allura"},
    {"file": "AlexBrush-Regular.ttf", "family": "Alex Brush"},
    {"file": "Pinyon-Regular.ttf", "family": "Pinyon Script"},
]

FONTS_DIR = os.path.join(os.getcwd(), "fonts")


# ============================================================
# ENUMS - Style Options
# ============================================================

class TextEffect(Enum):
    GLOW = "glow"
    EMBOSS = "emboss"
    OUTLINE = "outline"
    SHADOW = "shadow"
    NONE = "none"


class DecorativeStyle(Enum):
    ORNATE = "ornate"
    SIMPLE = "simple"
    ELEGANT = "elegant"
    MODERN = "modern"
    NONE = "none"


class TitleLayout(Enum):
    TOP_CENTER = "top-center"
    CENTER = "center"
    TOP_LEFT = "top-left"
    BOTTOM_CENTER = "bottom-center"


class TitleCase(Enum):
    UPPERCASE = "uppercase"
    TITLECASE = "titlecase"
    ORIGINAL = "original"


# ============================================================
# DATA CLASSES - Style Configuration
# ============================================================

@dataclass
class CoverStyle:
    font_family: str
    layout: TitleLayout
    text_effect: TextEffect
    decorative: DecorativeStyle
    title_case: TitleCase


@dataclass
class ExtractedColors:
    primary: str          # Main color from cover
    secondary: str        # Secondary color
    title_gradient_start: str
    title_gradient_end: str
    stroke_color: str     # Outline color for text
    is_dark_region: bool  # Whether title area is dark


# ============================================================
# COLOR EXTRACTION - Sample colors from the cover image
# ============================================================

def extract_colors_from_image(
    image: Image.Image, 
    width: int, 
    height: int, 
    seed: int
) -> ExtractedColors:
    """
    Extract colors from the title/author regions of the cover.
    This ensures text colors contrast well with the actual background.
    """
    
    # Define the region where title will be placed (top 40% of image)
    title_region_top = int(height * 0.1)
    title_region_bottom = int(height * 0.4)
    title_region_left = int(width * 0.1)
    title_region_right = int(width * 0.9)
    
    # Sample pixels from the title region
    pixels = []
    sample_step = 10  # Sample every 10th pixel for speed
    
    for y in range(title_region_top, title_region_bottom, sample_step):
        for x in range(title_region_left, title_region_right, sample_step):
            pixel = image.getpixel((x, y))
            if len(pixel) >= 3:
                pixels.append(pixel[:3])  # RGB only
    
    if not pixels:
        # Fallback if no pixels sampled
        return ExtractedColors(
            primary="#FFFFFF",
            secondary="#000000",
            title_gradient_start="#FFFFFF",
            title_gradient_end="#CCCCCC",
            stroke_color="#000000",
            is_dark_region=True
        )
    
    # Calculate average brightness of the title region
    brightness_values = []
    for r, g, b in pixels:
        # Perceived brightness formula
        brightness = (r * 0.299 + g * 0.587 + b * 0.114)
        brightness_values.append(brightness)
    
    # Use median brightness (more robust than mean)
    brightness_values.sort()
    median_brightness = brightness_values[len(brightness_values) // 2]
    
    # Determine if region is dark or light
    is_dark_region = median_brightness < 128
    
    # Find the lightest and darkest colors in the region
    sorted_by_brightness = sorted(
        pixels, 
        key=lambda p: p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114
    )
    
    darkest = sorted_by_brightness[0]
    lightest = sorted_by_brightness[-1]
    
    # Choose text color based on background brightness
    if is_dark_region:
        # Dark background -> use light text
        title_color = lightest
        stroke_color = darkest
    else:
        # Light background -> use dark text
        title_color = darkest
        stroke_color = lightest
    
    def rgb_to_hex(rgb: Tuple[int, int, int]) -> str:
        return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
    
    return ExtractedColors(
        primary=rgb_to_hex(title_color),
        secondary=rgb_to_hex(stroke_color),
        title_gradient_start=rgb_to_hex(title_color),
        title_gradient_end=rgb_to_hex(title_color),
        stroke_color=rgb_to_hex(stroke_color),
        is_dark_region=is_dark_region
    )


# ============================================================
# STYLE GENERATION - Create unique style per book
# ============================================================

def generate_cover_style(seed: int, genre: str) -> CoverStyle:
    """
    Generate a unique visual style based on the book's ID (seed).
    This ensures variety across covers while being reproducible.
    """
    
    random.seed(seed)
    
    # Pick a random script font
    font_choice = random.choice(SCRIPT_FONT_OPTIONS)
    font_family = font_choice["family"]
    
    # Pick layout
    layouts = list(TitleLayout)
    layout = random.choice(layouts)
    
    # Pick text effect
    effects = list(TextEffect)
    text_effect = random.choice(effects)
    
    # Pick decorative style
    decoratives = list(DecorativeStyle)
    decorative = random.choice(decoratives)
    
    # Pick title case
    cases = list(TitleCase)
    title_case = random.choice(cases)
    
    return CoverStyle(
        font_family=font_family,
        layout=layout,
        text_effect=text_effect,
        decorative=decorative,
        title_case=title_case
    )


# ============================================================
# TEXT WRAPPING - Break title into multiple lines
# ============================================================

def wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int
) -> List[str]:
    """
    Wrap text to fit within max_width pixels.
    Returns a list of lines.
    """
    
    words = text.split()
    lines = []
    current_line = ""
    
    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test_line, font=font)
        text_width = bbox[2] - bbox[0]
        
        if text_width <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word
    
    if current_line:
        lines.append(current_line)
    
    return lines


# ============================================================
# TITLE CLEANING - Remove markdown and special characters
# ============================================================

def extract_clean_title(title: str) -> str:
    """
    Clean up the title by removing markdown formatting,
    asterisks, and other special characters.
    """
    
    clean = title
    
    # Remove markdown bold/italic markers
    clean = clean.replace("**", "")
    clean = clean.replace("*", "")
    clean = clean.replace("__", "")
    clean = clean.replace("_", " ")
    
    # Remove quotes
    clean = clean.replace('"', '')
    clean = clean.replace("'", "'")
    
    # Normalize whitespace
    clean = " ".join(clean.split())
    
    return clean.strip()


# ============================================================
# MAIN FUNCTION - Add text overlay to cover image
# ============================================================

def add_text_overlay_to_cover(
    image_buffer: bytes,
    title: str,
    author: str,
    genre: str = "default",
    draft_id: int = 0
) -> bytes:
    """
    Add title and author text overlay to a cover image.
    
    Args:
        image_buffer: The raw bytes of the background image (PNG/JPEG)
        title: The book title to display
        author: The author name (always "EbookGames")
        genre: The book's genre (used for styling hints)
        draft_id: Unique ID used as seed for reproducible styling
    
    Returns:
        bytes: The modified image with text overlay as PNG bytes
    """
    
    # Load the background image
    image = Image.open(BytesIO(image_buffer)).convert("RGBA")
    width, height = image.size
    
    # Create a drawing context
    draw = ImageDraw.Draw(image)
    
    # Clean up the title
    clean_title = extract_clean_title(title)
    
    # Generate unique style based on draft ID
    seed = draft_id if draft_id > 0 else sum(ord(c) for c in clean_title + genre)
    style = generate_cover_style(seed, genre)
    
    # Extract colors from the cover for harmonized text
    colors = extract_colors_from_image(image, width, height, seed)
    
    # Apply title case transformation
    if style.title_case == TitleCase.UPPERCASE:
        display_title = clean_title.upper()
    elif style.title_case == TitleCase.TITLECASE:
        display_title = clean_title.title()
    else:
        display_title = clean_title
    
    # Calculate padding and text areas
    padding = int(width * 0.06)
    max_text_width = int(width * 0.85)
    
    # ========================================
    # LOAD FONTS
    # ========================================
    
    # Title font - try to load the script font
    title_font_size = max(48, min(72, int(width * 0.07)))
    try:
        font_path = os.path.join(FONTS_DIR, f"{style.font_family.replace(' ', '')}-Regular.ttf")
        title_font = ImageFont.truetype(font_path, title_font_size)
    except:
        # Fallback to default font
        title_font = ImageFont.load_default()
    
    # Author font - simpler font
    author_font_size = max(28, min(40, int(width * 0.04)))
    try:
        author_font = ImageFont.truetype(
            os.path.join(FONTS_DIR, "Inter-Regular.ttf"), 
            author_font_size
        )
    except:
        author_font = ImageFont.load_default()
    
    # ========================================
    # CALCULATE TITLE POSITION
    # ========================================
    
    # Determine title position based on layout style
    if style.layout == TitleLayout.TOP_CENTER:
        title_y = int(height * 0.15)
        text_align = "center"
    elif style.layout == TitleLayout.CENTER:
        title_y = int(height * 0.4)
        text_align = "center"
    elif style.layout == TitleLayout.TOP_LEFT:
        title_y = int(height * 0.15)
        text_align = "left"
    else:  # BOTTOM_CENTER
        title_y = int(height * 0.6)
        text_align = "center"
    
    # Wrap title text to fit width
    lines = wrap_text(draw, display_title, title_font, max_text_width)
    
    # Calculate line height
    bbox = draw.textbbox((0, 0), "Ay", font=title_font)
    line_height = int((bbox[3] - bbox[1]) * 1.2)
    
    # ========================================
    # DRAW TITLE TEXT
    # ========================================
    
    # Convert hex colors to RGB tuples
    def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
        hex_color = hex_color.lstrip("#")
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    title_color = hex_to_rgb(colors.title_gradient_start)
    stroke_color = hex_to_rgb(colors.stroke_color)
    
    for i, line in enumerate(lines):
        line_y = title_y + i * line_height
        
        # Calculate X position based on alignment
        bbox = draw.textbbox((0, 0), line, font=title_font)
        text_width = bbox[2] - bbox[0]
        
        if text_align == "center":
            line_x = (width - text_width) // 2
        elif text_align == "left":
            line_x = padding
        else:
            line_x = width - text_width - padding
        
        # Draw outline/stroke first (for visibility)
        stroke_width = 5
        for dx in range(-stroke_width, stroke_width + 1):
            for dy in range(-stroke_width, stroke_width + 1):
                if dx != 0 or dy != 0:
                    draw.text(
                        (line_x + dx, line_y + dy),
                        line,
                        font=title_font,
                        fill=stroke_color
                    )
        
        # Draw the main title text
        draw.text(
            (line_x, line_y),
            line,
            font=title_font,
            fill=title_color
        )
    
    # ========================================
    # DRAW AUTHOR TEXT
    # ========================================
    
    author_text = f"by {author}"
    author_y = height - padding * 2
    
    # Calculate author position (always centered)
    bbox = draw.textbbox((0, 0), author_text, font=author_font)
    author_width = bbox[2] - bbox[0]
    author_x = (width - author_width) // 2
    
    # Draw author with outline
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            if dx != 0 or dy != 0:
                draw.text(
                    (author_x + dx, author_y + dy),
                    author_text,
                    font=author_font,
                    fill=stroke_color
                )
    
    draw.text(
        (author_x, author_y),
        author_text,
        font=author_font,
        fill=title_color
    )
    
    # ========================================
    # EXPORT RESULT
    # ========================================
    
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


# ============================================================
# EXAMPLE USAGE
# ============================================================

if __name__ == "__main__":
    """
    Example of how to use this module:
    
    1. Load a background image
    2. Call add_text_overlay_to_cover() with title and author
    3. Save the result
    """
    
    # Example usage (would need an actual image file)
    example_code = '''
    # Load background image
    with open("background.png", "rb") as f:
        background_bytes = f.read()
    
    # Add text overlay
    result = add_text_overlay_to_cover(
        image_buffer=background_bytes,
        title="The Art of Python Programming",
        author="EbookGames",
        genre="Technology",
        draft_id=123
    )
    
    # Save the result
    with open("cover_with_text.png", "wb") as f:
        f.write(result)
    '''
    
    print("Cover Text Overlay - Python Reference")
    print("=" * 50)
    print("This module adds title and author text to cover images.")
    print()
    print("Key functions:")
    print("  - add_text_overlay_to_cover(): Main function")
    print("  - extract_colors_from_image(): Color sampling")
    print("  - generate_cover_style(): Style generation")
    print("  - wrap_text(): Text wrapping")
    print()
    print("Example usage:")
    print(example_code)
