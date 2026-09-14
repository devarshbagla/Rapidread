import { describe, expect, it } from 'vitest';
import { toToken } from '../parsers/tokenize';
import { buildLines, lineIndexAt, lineText } from './lines';

describe('buildLines', () => {
  it('breaks a long run into lines of at most twelve words', () => {
    const words = Array.from({ length: 25 }, (_, index) => toToken(`w${index}`));
    const lines = buildLines(words, 0, words.length);
    expect(lines.every((line) => line.end - line.start <= 12)).toBe(true);
    expect(lines[0]).toEqual({ start: 0, end: 12 });
    expect(lineIndexAt(lines, 13)).toBe(1);
    expect(lineText(words, lines[0]).startsWith('w0 ')).toBe(true);
  });

  it('breaks after a sentence once a line has enough words', () => {
    const words = [
      toToken('One'),
      toToken('two'),
      toToken('three'),
      toToken('four'),
      toToken('five.'),
      toToken('Next'),
    ];
    expect(buildLines(words, 0, words.length)).toEqual([
      { start: 0, end: 5 },
      { start: 5, end: 6 },
    ]);
  });
});
