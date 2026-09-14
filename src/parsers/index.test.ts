import { describe, expect, it } from 'vitest';
import { detectParser, parse } from './index';

describe('detectParser', () => {
  it('prefers the file extension over the mime type', () => {
    expect(detectParser(new File(['x'], 'notes.txt', { type: 'application/octet-stream' }) )?.id).toBe(
      'txt',
    );
    expect(detectParser(new File(['x'], 'book.epub'))?.id).toBe('epub');
  });

  it('falls back to the mime type when there is no extension', () => {
    expect(detectParser(new File(['x'], 'untitled', { type: 'text/plain' }) )?.id).toBe('txt');
  });
});

describe('parse', () => {
  it('explains unsupported formats without a stack trace', async () => {
    await expect(parse(new File(['%PDF'], 'paper.pdf'))).rejects.toThrow(
      ".pdf files aren't supported yet",
    );
  });

  it('routes a text file through the txt parser', async () => {
    const book = await parse(new File(['one two three'], 'sample.txt'));
    expect(book.chapters[0].tokens).toHaveLength(3);
  });
});
