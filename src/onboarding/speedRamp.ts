/** Tutorial playback starts here. */
export const TUTORIAL_START_WPM = 200;
/** Tutorial playback ends here. */
export const TUTORIAL_END_WPM = 700;

/** Ease-in cubic: gentle early, then snaps faster in the back half. */
export function easeInCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * clamped;
}

/**
 * WPM for a word index along the tutorial ramp.
 * Progress is over word indices so the final word lands at the end speed.
 */
export function tutorialWpm(index: number, wordCount: number): number {
  if (wordCount <= 1) return TUTORIAL_END_WPM;
  const t = Math.min(1, Math.max(0, index / (wordCount - 1)));
  return Math.round(TUTORIAL_START_WPM + (TUTORIAL_END_WPM - TUTORIAL_START_WPM) * easeInCubic(t));
}
