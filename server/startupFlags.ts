/**
 * Startup auto-resume killswitch for local Cursor dev.
 * When disabled: no auto bulk write, illustration queue, bulk publish, dialogue recheck, or
 * illustration marker reset → regen on server boot.
 */
export function isStartupAutoResumeDisabled(): boolean {
  if (process.env.DISABLE_STARTUP_AUTO_RESUME === "true") return true;
  if (process.env.ENABLE_STARTUP_AUTO_RESUME === "true") return false;
  return process.env.NODE_ENV === "development";
}
