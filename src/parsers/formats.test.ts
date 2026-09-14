import { describe, expect, it } from 'vitest';
import { detectParser } from './index';
import { htmlToText } from './htmlText';
import { markdownToText } from './markdown';
import { parseMarkdown } from './md';
import { looksLikeScannedPdf } from './ocr';

describe('detectParser', () => {
  it('detects new formats by extension', () => {
    expect(detectParser(new File([''], 'a.pdf'))?.id).toBe('pdf');
    expect(detectParser(new File([''], 'a.docx'))?.id).toBe('docx');
    expect(detectParser(new File([''], 'a.md'))?.id).toBe('md');
    expect(detectParser(new File([''], 'a.html'))?.id).toBe('html');
    expect(detectParser(new File([''], 'a.png'))?.id).toBe('image');
    expect(detectParser(new File([''], 'a.jpg'))?.id).toBe('image');
  });
});

describe('parseMarkdown', () => {
  it('strips common markdown syntax', async () => {
    const book = await parseMarkdown(
      new File(['# Hello\n\nThis is **bold** and *italic* with `code`.'], 'hello.md', {
        type: 'text/markdown',
      }),
    );
    expect(book.title).toBe('hello');
    expect(book.chapters).toHaveLength(1);
    const words = book.chapters[0]!.tokens.map((token) => token.text).join(' ');
    expect(words).toContain('Hello');
    expect(words).toContain('bold');
    expect(words).not.toContain('**');
    expect(words).not.toContain('`');
  });
});

describe('markdownToText', () => {
  it('keeps readable words without markup', () => {
    const text = markdownToText('# Title\n\nA **bold** word and `code`.');
    expect(text).toContain('Title');
    expect(text).toContain('bold');
    expect(text).not.toContain('**');
    expect(text).not.toContain('`');
  });
});

describe('htmlToText', () => {
  it('removes scripts and tags', () => {
    const text = htmlToText(
      '<html><head><script>alert(1)</script><style>p{}</style></head><body><h1>Title</h1><p>Hello&nbsp;world</p></body></html>',
    );
    expect(text).toContain('Title');
    expect(text).toContain('Hello');
    expect(text).toContain('world');
    expect(text).not.toContain('alert');
    expect(text).not.toContain('<');
  });
});

describe('looksLikeScannedPdf', () => {
  it('flags nearly empty extractable text as a scan', () => {
    expect(looksLikeScannedPdf('a few words', 10)).toBe(true);
    expect(looksLikeScannedPdf('word '.repeat(500), 2)).toBe(false);
  });
});
