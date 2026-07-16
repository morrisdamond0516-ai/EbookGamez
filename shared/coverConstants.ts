/** Draft IDs whose cover image files were lost in the Mar 2026 local Cursor wipe. */
export const LOST_COVER_REGEN_IDS = new Set([
  646, 648,
  ...Array.from({ length: 22 }, (_, i) => 707 + i), // #707–#728 research batch
]);

export function isLostCoverRegenDraft(id: number): boolean {
  return LOST_COVER_REGEN_IDS.has(id);
}
