import { describe, expect, it } from 'vitest';
import { COACH_LINES, coachChunkAt, coachTokens } from './coaching';

describe('coaching', () => {
  it('tokenizes each coach line', () => {
    for (const kind of Object.keys(COACH_LINES) as (keyof typeof COACH_LINES)[]) {
      const tokens = coachTokens(kind);
      expect(tokens.length).toBeGreaterThan(5);
      expect(tokens.map((token) => token.text).join(' ')).toBe(COACH_LINES[kind]);
    }
  });

  it('builds single-word chunks for the word stage', () => {
    const tokens = coachTokens('playPause');
    const chunk = coachChunkAt(tokens, 0);
    expect(chunk.words).toEqual([tokens[0]]);
    expect(chunk.end - chunk.start).toBe(1);
  });
});
