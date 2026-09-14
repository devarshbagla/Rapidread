/** How long each chunk stays on screen, and how the adaptive ramp moves. */

/** Extra dwell after a comma/semicolon/colon, as a fraction of one word. */
export const CLAUSE_PAUSE_RATIO = 0.35;
/** Extra dwell after `.`/`!`/`?`, as a fraction of one word. */
export const SENTENCE_PAUSE_RATIO = 0.9;

/** Adaptive pacing: +5 WPM for every 1,000 words read. */
export const RAMP_WPM_PER_INTERVAL = 5;
export const RAMP_WORD_INTERVAL = 1000;
/** Never schedule a frame shorter than this, whatever the numbers say. */
export const MIN_CHUNK_MS = 24;

export interface ChunkPacing {
  wpm: number;
  chunkWordCount: number;
  endsSentence: boolean;
  endsClause: boolean;
  punctuationWeight: number;
}

export function msPerWord(wpm: number): number {
  return 60_000 / Math.max(1, wpm);
}

export function chunkDurationMs({
  wpm,
  chunkWordCount,
  endsSentence,
  endsClause,
  punctuationWeight,
}: ChunkPacing): number {
  const perWord = msPerWord(wpm);
  const weight = Math.max(0, punctuationWeight);
  const base = perWord * Math.max(1, chunkWordCount);

  let extra = 0;
  if (endsSentence) extra = perWord * SENTENCE_PAUSE_RATIO * weight;
  else if (endsClause) extra = perWord * CLAUSE_PAUSE_RATIO * weight;

  return Math.max(MIN_CHUNK_MS, base + extra);
}

/** The two pause lengths, for showing concrete numbers in Settings. */
export function punctuationPauses(
  wpm: number,
  punctuationWeight: number,
): { clause: number; sentence: number } {
  const perWord = msPerWord(wpm);
  const weight = Math.max(0, punctuationWeight);
  return {
    clause: Math.round(perWord * CLAUSE_PAUSE_RATIO * weight),
    sentence: Math.round(perWord * SENTENCE_PAUSE_RATIO * weight),
  };
}

export interface RampInput {
  enabled: boolean;
  /** Speed the ramp counts up from; a manual change moves it. */
  baselineWpm: number;
  /** Words read since the baseline last moved. */
  wordsSinceBaseline: number;
  /** Speed the book was opened at; the cap is twice this. */
  startWpm: number;
}

/**
 * Effective speed with the adaptive ramp applied. The cap is 2x the speed the
 * book started at, and never below the current baseline, so a manual override
 * is always honoured.
 */
export function rampedWpm({
  enabled,
  baselineWpm,
  wordsSinceBaseline,
  startWpm,
}: RampInput): number {
  if (!enabled) return baselineWpm;

  const intervals = Math.floor(Math.max(0, wordsSinceBaseline) / RAMP_WORD_INTERVAL);
  const cap = Math.max(startWpm * 2, baselineWpm);
  return Math.min(baselineWpm + intervals * RAMP_WPM_PER_INTERVAL, cap);
}
