import { describe, expect, it } from 'vitest';
import { orpIndex, orpOffsetForLength, splitAtOrp } from './orp';

describe('orpOffsetForLength', () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
    [6, 3],
    [9, 3],
    [10, 4],
    [13, 4],
    [14, 5],
    [40, 5],
  ] as const)('maps length %i to offset %i', (length, offset) => {
    expect(orpOffsetForLength(length)).toBe(offset);
  });
});

describe('orpIndex', () => {
  it('lands on the only letter of a one-letter word', () => {
    expect(orpIndex('I')).toBe(0);
  });

  it('skips a leading quote so the highlight is a letter', () => {
    const word = '\u201cThe';
    expect(orpIndex(word)).toBeGreaterThan(0);
    expect(word[orpIndex(word)]).toBe('h');
  });

  it('never walks past the last character', () => {
    expect(orpIndex('supercalifragilistic')).toBeLessThan(20);
  });
});

describe('splitAtOrp', () => {
  it('splits the word around a single focus letter', () => {
    expect(splitAtOrp('reading')).toEqual({ before: 'rea', focus: 'd', after: 'ing' });
  });
});
