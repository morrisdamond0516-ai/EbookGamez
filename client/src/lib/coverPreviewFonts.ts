/** Loads decorative Google Fonts used by cover style previews (not needed on the storefront). */
const COVER_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Lora:wght@400;700&family=Great+Vibes&family=Oswald:wght@400;700&family=Cormorant+Garamond:wght@400;700&family=Crimson+Text:wght@400;700&family=Montserrat:wght@400;700&family=EB+Garamond:wght@400;700&family=Merriweather:wght@400;700&family=Raleway:wght@400;700&family=Roboto:wght@400;700&family=Lato:wght@400;700&family=Bebas+Neue&family=Rajdhani:wght@400;700&family=Dancing+Script:wght@400;700&family=Abril+Fatface&family=Anton&family=Lobster&family=Pacifico&family=Sacramento&family=Prata&family=Spectral:wght@400;700&family=Nunito:wght@400;700&display=swap";

const LINK_ID = "ebgz-cover-preview-fonts";

export function ensureCoverPreviewFontsLoaded() {
  if (typeof document === "undefined") return;
  if (document.getElementById(LINK_ID)) return;
  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = COVER_FONTS_HREF;
  document.head.appendChild(link);
}
