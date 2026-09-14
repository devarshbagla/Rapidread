import type { Token } from '../types/book';

export interface Line {
  start: number;
  /** One past the last word on the line. */
  end: number;
}

const MAX_WORDS = 12;
const MIN_WORDS_BEFORE_SENTENCE_BREAK = 5;
const MIN_WORDS_BEFORE_CLAUSE_BREAK = 9;

/**
 * Group a word range into readable lines for preview mode. Lines break on
 * sentence and clause boundaries where they fall naturally, so the preview
 * reads like prose instead of a wrapped ribbon.
 *
 * Only word indices are stored: a chapter's worth of lines is cheap, and the
 * text is built on demand for the handful of lines actually on screen.
 */
export function buildLines(words: Token[], from: number, to: number): Line[] {
  const start = Math.max(0, from);
  const limit = Math.min(to, words.length);
  const lines: Line[] = [];

  let lineStart = start;
  for (let index = start; index < limit; index += 1) {
    const count = index - lineStart + 1;
    const token = words[index];
    const shouldBreak =
      count >= MAX_WORDS ||
      (token.isSentenceEnd && count >= MIN_WORDS_BEFORE_SENTENCE_BREAK) ||
      (token.isClauseEnd && count >= MIN_WORDS_BEFORE_CLAUSE_BREAK);

    if (shouldBreak) {
      lines.push({ start: lineStart, end: index + 1 });
      lineStart = index + 1;
    }
  }
  if (lineStart < limit) lines.push({ start: lineStart, end: limit });

  return lines;
}

/** Index of the line containing `wordIndex`, or the nearest one. */
export function lineIndexAt(lines: Line[], wordIndex: number): number {
  if (lines.length === 0) return 0;

  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lines[mid].start <= wordIndex) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function lineText(words: Token[], line: Line): string {
  let text = '';
  for (let index = line.start; index < line.end; index += 1) {
    text += index === line.start ? words[index].text : ` ${words[index].text}`;
  }
  return text;
}
