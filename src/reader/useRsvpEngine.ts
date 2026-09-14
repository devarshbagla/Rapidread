import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clampWpm, type ChunkSize } from '../store/settings';
import { chunkAt, type Chunk } from './chunking';
import { chapterAt, type ChapterSpan, type FlatBook } from './flatten';
import { chunkDurationMs, MIN_CHUNK_MS, rampedWpm } from './pacing';

export interface RsvpEngineOptions {
  book: FlatBook;
  chunkSize: ChunkSize;
  punctuationWeight: number;
  adaptivePacing: boolean;
  initialIndex: number;
  initialWpm: number;
  /** True when the book was already read to the end. */
  initialFinished: boolean;
}

export interface EngineSnapshot {
  wordIndex: number;
  wpm: number;
  finished: boolean;
}

export interface RsvpEngine {
  index: number;
  chunk: Chunk;
  chapter: ChapterSpan;
  isPlaying: boolean;
  /** Word held still while a speed drag is in progress. */
  isFrozen: boolean;
  finished: boolean;
  /** Speed actually being used, adaptive ramp included. */
  wpm: number;
  /** Speed the ramp counts up from. */
  baselineWpm: number;
  /** Words consumed since the baseline last moved; drives the +5/1000 ramp. */
  wordsSinceBaseline: number;
  fraction: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  restart: () => void;
  seek: (index: number) => void;
  step: (delta: number) => void;
  setWpm: (wpm: number) => void;
  nudgeWpm: (delta: number) => void;
  setFrozen: (frozen: boolean) => void;
  snapshot: () => EngineSnapshot;
}

/**
 * Drives word-to-word playback. Timing is scheduled one chunk at a time and
 * compensated for timer lateness, so the average speed matches the requested
 * WPM instead of drifting slow.
 */
export function useRsvpEngine({
  book,
  chunkSize,
  punctuationWeight,
  adaptivePacing,
  initialIndex,
  initialWpm,
  initialFinished,
}: RsvpEngineOptions): RsvpEngine {
  const lastIndex = Math.max(0, book.wordCount - 1);
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), lastIndex));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [finished, setFinished] = useState(initialFinished);
  const [baselineWpm, setBaselineWpm] = useState(() => clampWpm(initialWpm));
  const [wordsSinceBaseline, setWordsSinceBaseline] = useState(0);

  // The ramp is capped against the speed this book was opened at, and resets
  // with the hook — which is remounted per book.
  const [startWpm] = useState(() => clampWpm(initialWpm));
  const lateness = useRef(0);

  const chapter = useMemo(() => chapterAt(book, index), [book, index]);
  const chunk = useMemo(
    () => chunkAt(book.words, index, chunkSize, chapter.end),
    [book.words, index, chunkSize, chapter.end],
  );

  const wpm = rampedWpm({
    enabled: adaptivePacing,
    baselineWpm,
    wordsSinceBaseline,
    startWpm,
  });

  // Mirror of the values the timer and the imperative controls need. Written
  // after commit, read only from callbacks that run after commit.
  const state = useRef({ index, wpm, baselineWpm, finished, chunkSize, chapterEnd: chapter.end });
  useEffect(() => {
    state.current = { index, wpm, baselineWpm, finished, chunkSize, chapterEnd: chapter.end };
  });

  // Turning the ramp on mid-book must start from the current speed, not from
  // words that were read while it was off.
  const [pacingGate, setPacingGate] = useState(adaptivePacing);
  if (pacingGate !== adaptivePacing) {
    setPacingGate(adaptivePacing);
    setWordsSinceBaseline(0);
  }

  const advance = useCallback(() => {
    const current = state.current;
    const active = chunkAt(book.words, current.index, current.chunkSize, current.chapterEnd);
    const consumed = Math.max(1, active.end - active.start);

    if (active.end >= book.wordCount) {
      setIndex(active.start);
      setIsPlaying(false);
      setFinished(true);
      return;
    }
    setIndex(active.end);
    if (adaptivePacing) setWordsSinceBaseline((words) => words + consumed);
  }, [adaptivePacing, book]);

  useEffect(() => {
    if (!isPlaying || isFrozen || finished) return;

    const duration = chunkDurationMs({
      wpm,
      chunkWordCount: chunk.end - chunk.start,
      endsSentence: chunk.endsSentence,
      endsClause: chunk.endsClause,
      punctuationWeight,
    });
    // Subtract how late the previous frame fired so drift doesn't accumulate.
    const delay = Math.max(MIN_CHUNK_MS, duration - lateness.current);
    const scheduledAt = performance.now();

    const timer = window.setTimeout(() => {
      lateness.current = Math.min(60, Math.max(0, performance.now() - scheduledAt - delay));
      advance();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    advance,
    chunk.end,
    chunk.endsClause,
    chunk.endsSentence,
    chunk.start,
    finished,
    isFrozen,
    isPlaying,
    punctuationWeight,
    wpm,
  ]);

  const play = useCallback(() => {
    if (state.current.finished) return;
    lateness.current = 0;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (state.current.finished) return;
    lateness.current = 0;
    setIsPlaying((playing) => !playing);
  }, []);

  const seek = useCallback(
    (next: number) => {
      lateness.current = 0;
      setIndex(Math.min(Math.max(Math.round(next), 0), lastIndex));
      setFinished(false);
      setIsPlaying(false);
    },
    [lastIndex],
  );

  const step = useCallback(
    (delta: number) => {
      seek(state.current.index + delta);
    },
    [seek],
  );

  const restart = useCallback(() => {
    lateness.current = 0;
    setIndex(0);
    setFinished(false);
    setWordsSinceBaseline(0);
    setIsPlaying(true);
  }, []);

  // Manual speed changes move the ramp's baseline and restart its count.
  const setWpm = useCallback((next: number) => {
    setBaselineWpm(clampWpm(next));
    setWordsSinceBaseline(0);
  }, []);

  const nudgeWpm = useCallback(
    (delta: number) => {
      setWpm(state.current.wpm + delta);
    },
    [setWpm],
  );

  const setFrozen = useCallback((frozen: boolean) => {
    lateness.current = 0;
    setIsFrozen(frozen);
  }, []);

  // Persist the chosen speed, not the ramped one: the ramp is a per-session
  // effect that starts over every time a book is opened.
  const snapshot = useCallback(
    () => ({
      wordIndex: state.current.index,
      wpm: state.current.baselineWpm,
      finished: state.current.finished,
    }),
    [],
  );

  return {
    index,
    chunk,
    chapter,
    isPlaying,
    isFrozen,
    finished,
    wpm,
    baselineWpm,
    wordsSinceBaseline,
    fraction: finished ? 1 : book.wordCount === 0 ? 0 : Math.min(1, chunk.end / book.wordCount),
    play,
    pause,
    toggle,
    restart,
    seek,
    step,
    setWpm,
    nudgeWpm,
    setFrozen,
    snapshot,
  };
}
