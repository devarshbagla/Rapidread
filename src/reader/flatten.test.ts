import { describe, expect, it } from 'vitest';
import { toToken } from '../parsers/tokenize';
import { chapterAt, flattenBook } from './flatten';

describe('flattenBook', () => {
  it('concatenates chapters into one word stream and records their spans', () => {
    const book = flattenBook({
      title: 'A Book',
      author: 'Someone',
      chapters: [
        { title: 'One', tokens: [toToken('hello'), toToken('there.')] },
        { title: 'Two', tokens: [toToken('later')] },
        { title: 'Empty', tokens: [] },
      ],
    });

    expect(book.wordCount).toBe(3);
    expect(book.words.map((token) => token.text)).toEqual(['hello', 'there.', 'later']);
    expect(book.chapters).toEqual([
      { index: 0, title: 'One', start: 0, end: 2 },
      { index: 1, title: 'Two', start: 2, end: 3 },
    ]);
    expect(chapterAt(book, 0).title).toBe('One');
    expect(chapterAt(book, 1).title).toBe('One');
    expect(chapterAt(book, 2).title).toBe('Two');
  });
});
