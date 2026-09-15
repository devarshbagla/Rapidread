import { describe, expect, it } from 'vitest';
import type { NormalizedBook } from '../types/book';
import { fingerprintBook } from './fingerprint';

const sample: NormalizedBook = {
  title: 'The Time Machine',
  author: 'H. G. Wells',
  chapters: [{ title: 'I', tokens: [{ text: 'Hello', isSentenceEnd: false, isClauseEnd: false }] }],
};

describe('fingerprintBook', () => {
  it('is stable for the same text and changes when a word changes', async () => {
    const first = await fingerprintBook(sample);
    const second = await fingerprintBook({ ...sample, author: 'H. G. Wells' });
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    const other = await fingerprintBook({
      ...sample,
      chapters: [{ title: 'I', tokens: [{ text: 'Goodbye', isSentenceEnd: false, isClauseEnd: false }] }],
    });
    expect(other).not.toBe(first);
  });
});
