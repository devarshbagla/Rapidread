import { describe, expect, it } from 'vitest';
import { ImportError } from './errors';
import { parseTxt } from './txt';

describe('parseTxt', () => {
  it('produces a single chapter of tokens', async () => {
    const book = await parseTxt(new File(['Hello, world. Next'], 'hello_world.txt', { type: 'text/plain' }));
    expect(book.title).toBe('hello world');
    expect(book.chapters).toHaveLength(1);
    expect(book.chapters[0].tokens.map((token) => token.text)).toEqual(['Hello,', 'world.', 'Next']);
    expect(book.chapters[0].tokens[0].isClauseEnd).toBe(true);
    expect(book.chapters[0].tokens[1].isSentenceEnd).toBe(true);
  });

  it('rejects an empty file with a plain sentence', async () => {
    await expect(parseTxt(new File(['   \n'], 'blank.txt'))).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ImportError);
      expect((error as ImportError).message).toContain('blank.txt');
      expect((error as ImportError).message).toContain('empty');
      return true;
    });
  });
});
