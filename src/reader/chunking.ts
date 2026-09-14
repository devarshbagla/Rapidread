import type { Token } from '../types/book';

export interface Chunk {
  start: number;
  /** One past the last word in the chunk. */
  end: number;
  words: Token[];
  endsSentence: boolean;
  endsClause: boolean;
}

const EMPTY_CHUNK: Chunk = {
  start: 0,
  end: 0,
  words: [],
  endsSentence: false,
  endsClause: false,
};

/**
 * The chunk that starts at `start`. Chunks are derived from the current index
 * rather than precomputed, so changing chunk size mid-book is instant and
 * progress stays a plain word index.
 *
 * A chunk never runs past `limit` (the chapter boundary) and always breaks
 * after a sentence-ending word, so the punctuation pause lands where it should.
 */
export function chunkAt(words: Token[], start: number, size: number, limit?: number): Chunk {
  if (words.length === 0) return EMPTY_CHUNK;

  const first = Math.min(Math.max(start, 0), words.length - 1);
  const max = Math.min(Math.max(limit ?? words.length, first + 1), words.length);

  let end = first;
  while (end < max && end - first < size) {
    const sentenceEnd = words[end].isSentenceEnd;
    end += 1;
    if (sentenceEnd) break;
  }

  const chunkWords = words.slice(first, end);
  const last = chunkWords.at(-1);
  return {
    start: first,
    end,
    words: chunkWords,
    endsSentence: last?.isSentenceEnd ?? false,
    endsClause: last?.isClauseEnd ?? false,
  };
}
