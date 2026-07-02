export function getConsentStatus(): "accepted" | "declined" | null {
  return localStorage.getItem("cookie_consent") as "accepted" | "declined" | null;
}

export function hasTrackingConsent(): boolean {
  return getConsentStatus() === "accepted";
}
