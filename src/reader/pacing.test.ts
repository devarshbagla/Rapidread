import { describe, expect, it } from 'vitest';
import {
  chunkDurationMs,
  MIN_CHUNK_MS,
  msPerWord,
  rampedWpm,
  RAMP_WPM_PER_INTERVAL,
  RAMP_WORD_INTERVAL,
} from './pacing';

describe('chunkDurationMs', () => {
  it('gives one word at 300 wpm 200ms', () => {
    expect(
      chunkDurationMs({
        wpm: 300,
        chunkWordCount: 1,
        endsSentence: false,
        endsClause: false,
        punctuationWeight: 1,
      }),
    ).toBe(200);
  });

  it('scales the base duration with the chunk size', () => {
    expect(
      chunkDurationMs({
        wpm: 300,
        chunkWordCount: 3,
        endsSentence: false,
        endsClause: false,
        punctuationWeight: 1,
      }),
    ).toBe(600);
  });

  it('adds a longer pause after a sentence than after a clause', () => {
    const clause = chunkDurationMs({
      wpm: 300,
      chunkWordCount: 1,
      endsSentence: false,
      endsClause: true,
      punctuationWeight: 1,
    });
    const sentence = chunkDurationMs({
      wpm: 300,
      chunkWordCount: 1,
      endsSentence: true,
      endsClause: false,
      punctuationWeight: 1,
    });
    expect(sentence).toBeGreaterThan(clause);
    expect(clause).toBeGreaterThan(msPerWord(300));
  });

  it('disables extra dwell when the weight is zero', () => {
    expect(
      chunkDurationMs({
        wpm: 300,
        chunkWordCount: 1,
        endsSentence: true,
        endsClause: false,
        punctuationWeight: 0,
      }),
    ).toBe(200);
  });

  it('never schedules a frame shorter than the floor', () => {
    expect(
      chunkDurationMs({
        wpm: 10_000,
        chunkWordCount: 1,
        endsSentence: false,
        endsClause: false,
        punctuationWeight: 0,
      }),
    ).toBe(MIN_CHUNK_MS);
  });
});

describe('rampedWpm', () => {
  it('returns the baseline when adaptive pacing is off', () => {
    expect(
      rampedWpm({
        enabled: false,
        baselineWpm: 300,
        wordsSinceBaseline: 50_000,
        startWpm: 300,
      }),
    ).toBe(300);
  });

  it('adds 5 wpm per 1,000 words', () => {
    expect(
      rampedWpm({
        enabled: true,
        baselineWpm: 300,
        wordsSinceBaseline: RAMP_WORD_INTERVAL * 3,
        startWpm: 300,
      }),
    ).toBe(300 + 3 * RAMP_WPM_PER_INTERVAL);
  });

  it('caps at twice the book\u2019s starting speed', () => {
    expect(
      rampedWpm({
        enabled: true,
        baselineWpm: 300,
        wordsSinceBaseline: 1_000_000,
        startWpm: 300,
      }),
    ).toBe(600);
  });

  it('never drops below a newly set baseline', () => {
    expect(
      rampedWpm({
        enabled: true,
        baselineWpm: 700,
        wordsSinceBaseline: 0,
        startWpm: 300,
      }),
    ).toBe(700);
  });
});
