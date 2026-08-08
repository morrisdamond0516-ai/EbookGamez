/** Warm LearnForge + LinksShrink so outbound clicks feel faster. */

export const PARTNER_URLS = {
  linksshrink: "https://linksshrink.com/",
  learnforge: "https://knowledge-builder.replit.app/",
} as const;

const warmed = new Set<string>();

function ensureHeadLink(rel: string, href: string, attrs: Record<string, string> = {}) {
  const key = `${rel}|${href}`;
  if (document.head.querySelector(`link[data-partner-warm="${key}"]`)) return;
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  link.dataset.partnerWarm = key;
  for (const [k, v] of Object.entries(attrs)) {
    link.setAttribute(k, v);
  }
  document.head.appendChild(link);
}

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/** DNS + TLS handshake early (cheap). Call once after homepage settles. */
export function warmPartnerOrigins() {
  if (typeof document === "undefined") return;
  for (const url of Object.values(PARTNER_URLS)) {
    const origin = originOf(url);
    ensureHeadLink("dns-prefetch", origin);
    ensureHeadLink("preconnect", origin, { crossorigin: "" });
  }
}

/**
 * Prefetch the partner document + nudge cold hosts with a low-priority fetch.
 * Safe to call on idle and again on hover/focus.
 */
export function warmPartnerSite(url: string) {
  if (typeof document === "undefined") return;
  const href = url.endsWith("/") || url.includes("?") ? url : `${url}/`;
  warmPartnerOrigins();
  ensureHeadLink("prefetch", href, { as: "document" });

  if (warmed.has(href)) return;
  warmed.add(href);

  fetch(href, {
    mode: "no-cors",
    credentials: "omit",
    cache: "force-cache",
  }).catch(() => { /* ignore — external site may be offline or CORS-blocked */ });
}

export function warmAllPartnersIdle() {
  const run = () => {
    warmPartnerOrigins();
    for (const url of Object.values(PARTNER_URLS)) {
      warmPartnerSite(url);
    }
  };

  if (typeof window === "undefined") return () => {};

  let idleId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const ric = window.requestIdleCallback?.bind(window);
  if (ric) {
    idleId = ric(() => run(), { timeout: 2800 });
  } else {
    timeoutId = setTimeout(run, 2000);
  }

  return () => {
    if (idleId != null && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
    if (timeoutId != null) clearTimeout(timeoutId);
  };
}
