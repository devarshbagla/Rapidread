import { describe, expect, it } from 'vitest';
import type { Token } from '../types/book';
import { chunkAt } from './chunking';

function words(...texts: string[]): Token[] {
  return texts.map((text) => ({
    text,
    isSentenceEnd: text.endsWith('.'),
    isClauseEnd: text.endsWith(','),
  }));
}

describe('chunkAt', () => {
  it('returns an empty chunk for an empty book', () => {
    expect(chunkAt([], 0, 2).words).toEqual([]);
  });

  it('groups up to the requested number of words', () => {
    const chunk = chunkAt(words('one', 'two', 'three', 'four'), 0, 3);
    expect(chunk.words.map((token) => token.text)).toEqual(['one', 'two', 'three']);
    expect(chunk.start).toBe(0);
    expect(chunk.end).toBe(3);
  });

  it('breaks after a sentence even if the chunk is not full', () => {
    const chunk = chunkAt(words('Stop.', 'Go', 'on'), 0, 3);
    expect(chunk.words.map((token) => token.text)).toEqual(['Stop.']);
    expect(chunk.endsSentence).toBe(true);
  });

  it('does not run past a chapter limit', () => {
    const chunk = chunkAt(words('a', 'b', 'c', 'd'), 0, 3, 2);
    expect(chunk.end).toBe(2);
  });
});
