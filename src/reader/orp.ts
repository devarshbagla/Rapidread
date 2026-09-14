/**
 * Optimal recognition point: the letter the eye should land on. Its offset
 * grows with word length so the fixation stays slightly left of centre, which
 * is where readers naturally anchor.
 */

const LEADING_PUNCTUATION = /^[^\p{L}\p{N}]+/u;
const TRAILING_PUNCTUATION = /[^\p{L}\p{N}]+$/u;

/** Offset into the word's letters, by letter count. */
export function orpOffsetForLength(length: number): number {
  if (length <= 1) return 0;
  if (length <= 3) return 1;
  if (length <= 5) return 2;
  if (length <= 9) return 3;
  if (length <= 13) return 4;
  return 5;
}

/**
 * Index of the ORP character within `word` as displayed. Leading quotes and
 * brackets are skipped so the highlight lands on a letter, never on a mark.
 */
export function orpIndex(word: string): number {
  if (word.length === 0) return 0;

  const leading = LEADING_PUNCTUATION.exec(word)?.[0].length ?? 0;
  const core = word.slice(leading).replace(TRAILING_PUNCTUATION, '');
  const length = core.length > 0 ? core.length : word.length;
  return Math.min(leading + orpOffsetForLength(length), word.length - 1);
}

export interface OrpSplit {
  before: string;
  focus: string;
  after: string;
}

/** Split a word around its ORP character for three-column rendering. */
export function splitAtOrp(word: string): OrpSplit {
  const index = orpIndex(word);
  return {
    before: word.slice(0, index),
    focus: word.slice(index, index + 1),
    after: word.slice(index + 1),
  };
}
