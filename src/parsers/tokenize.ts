import type { Token } from '../types/book';

const SENTENCE_ENDERS = new Set(['.', '!', '?', '\u2026']);
const CLAUSE_ENDERS = new Set([',', ';', ':', '\u2014', '\u2013']);

/** Closing quotes/brackets that may sit after the real punctuation mark. */
const TRAILING_WRAPPERS = /[)\]}"'\u2019\u201d\u00bb\u203a*_]+$/u;

/** Zero-width and formatting characters that survive HTML extraction. */
const INVISIBLES = /[\u00ad\u200b-\u200d\u2060\ufeff]/g;

/**
 * Words that end in a period without ending a sentence. Deliberately short —
 * the cost of a miss is one slightly long pause, not a wrong word.
 */
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'mx',
  'dr',
  'prof',
  'rev',
  'hon',
  'st',
  'jr',
  'sr',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'cf',
  'al',
  'fig',
  'no',
  'vol',
  'ch',
  'ed',
  'pp',
  'inc',
  'ltd',
  'co',
  'dept',
  'est',
  'approx',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sept',
  'sep',
  'oct',
  'nov',
  'dec',
]);

/** `U.S.A` / `p.m` style words, where the final period is not a full stop. */
const INITIALISM = /^(?:\p{L}\.)+\p{L}$/u;

function strippedOfWrappers(word: string): string {
  return word.replace(TRAILING_WRAPPERS, '');
}

function endsSentence(core: string): boolean {
  const last = core.at(-1);
  if (last === undefined || !SENTENCE_ENDERS.has(last)) return false;
  if (last !== '.') return true;

  const bare = core.slice(0, -1);
  // A single letter before the period is an initial ("J. R. R. Tolkien").
  if (bare.length <= 1) return false;
  if (ABBREVIATIONS.has(bare.toLowerCase())) return false;
  return !INITIALISM.test(bare);
}

function endsClause(core: string): boolean {
  const last = core.at(-1);
  return last !== undefined && CLAUSE_ENDERS.has(last);
}

/** Build a single token, classifying its trailing punctuation. */
export function toToken(text: string): Token {
  const core = strippedOfWrappers(text);
  const sentenceEnd = endsSentence(core);
  return {
    text,
    isSentenceEnd: sentenceEnd,
    isClauseEnd: !sentenceEnd && endsClause(core),
  };
}

/**
 * Split plain text into tokens on whitespace. Shared by every parser so that
 * pacing behaves identically no matter which format a book came from.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const raw of text.replace(INVISIBLES, '').split(/\s+/)) {
    if (raw.length === 0) continue;
    tokens.push(toToken(raw));
  }
  return tokens;
}
