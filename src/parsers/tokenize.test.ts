import { describe, expect, it } from 'vitest';
import { tokenize } from './tokenize';

describe('tokenize', () => {
  it('splits on whitespace and drops empty tokens', () => {
    expect(tokenize('  the   quick\n\tbrown  ').map((token) => token.text)).toEqual([
      'the',
      'quick',
      'brown',
    ]);
  });

  it('marks sentence ends', () => {
    const tokens = tokenize('He left. She stayed! Why? Then\u2026 done');
    expect(tokens.filter((token) => token.isSentenceEnd).map((token) => token.text)).toEqual([
      'left.',
      'stayed!',
      'Why?',
      'Then\u2026',
    ]);
  });

  it('sees through trailing quotes and brackets', () => {
    const [quoted, parenthesised] = tokenize('\u201cstop.\u201d (later,)');
    expect(quoted.isSentenceEnd).toBe(true);
    expect(parenthesised.isClauseEnd).toBe(true);
  });

  it('marks clause ends and never both flags at once', () => {
    const tokens = tokenize('first, second; third: fourth.');
    expect(tokens.map((token) => token.isClauseEnd)).toEqual([true, true, true, false]);
    expect(tokens.every((token) => !(token.isClauseEnd && token.isSentenceEnd))).toBe(true);
  });

  it('does not end a sentence on abbreviations or initials', () => {
    const tokens = tokenize('Mr. Smith met J. R. Hobbs at 5 p.m. Monday');
    const enders = tokens.filter((token) => token.isSentenceEnd).map((token) => token.text);
    expect(enders).toEqual([]);
  });

  it('strips zero-width characters', () => {
    expect(tokenize('sha\u00adred te\u200bxt').map((token) => token.text)).toEqual([
      'shared',
      'text',
    ]);
  });
});
