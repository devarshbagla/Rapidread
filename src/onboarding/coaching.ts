import { tokenize } from '../parsers/tokenize';
import type { Chunk } from '../reader/chunking';
import type { Token } from '../types/book';

export type CoachKind = 'playPause' | 'speed' | 'preview' | 'step';

/** First-time confirmations, RSVP'd through the same word stage. */
export const COACH_LINES: Record<CoachKind, string> = {
  playPause: 'yes, thats how u pause and play, lets get back to the tutorial',
  speed: 'yep, thats how u change your speed, lets get back to the tutorial',
  preview: 'thats the preview, tap a line to jump or close it, lets get back to the tutorial',
  step: 'yep, left and right step one word and pause, lets get back to the tutorial',
};

/** Comfortable fixed pace for coaching asides. */
export const COACH_WPM = 320;

export function coachTokens(kind: CoachKind): Token[] {
  return tokenize(COACH_LINES[kind]);
}

export function coachChunkAt(tokens: Token[], index: number): Chunk {
  const word = tokens[index];
  if (word === undefined) {
    return { start: 0, end: 0, words: [], endsSentence: false, endsClause: false };
  }
  return {
    start: index,
    end: index + 1,
    words: [word],
    endsSentence: word.isSentenceEnd,
    endsClause: word.isClauseEnd,
  };
}
