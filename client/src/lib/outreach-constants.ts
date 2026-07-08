import { COMPANY } from "./company";

export const OUTREACH = {
  name: "Damond Morris",
  phone: COMPANY.phone,
  yahooEmail: COMPANY.email,
  ebookgamezUrl: COMPANY.siteUrl,
} as const;

export function outreachSignature(): string {
  return `${OUTREACH.name}\n${OUTREACH.phone}\n${OUTREACH.yahooEmail}`;
}

export function learnforgeGamesUrl(): string {
  const base =
    (typeof import.meta !== "undefined" &&
      (import.meta as { env?: { VITE_LEARNFORGE_URL?: string } }).env?.VITE_LEARNFORGE_URL) ||
    "https://ebookgamez.com";
  return `${base.replace(/\/$/, "")}/games`;
}

export function ebookgamezCatalogUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/catalog`;
}

export function ebookgamezGamesUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/games`;
}
