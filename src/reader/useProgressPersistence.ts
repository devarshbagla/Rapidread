import { useCallback, useEffect, useRef } from 'react';
import { saveProgress } from '../store/db';
import type { EngineSnapshot } from './useRsvpEngine';

const SAVE_INTERVAL_MS = 4000;

interface ProgressPersistenceOptions {
  bookId: string;
  wordCount: number;
  isPlaying: boolean;
  snapshot: () => EngineSnapshot;
}

/**
 * Write reading position to storage on a slow interval while playing, and at
 * every point where the reader might disappear — pause, tab hide, unmount.
 * Nothing here touches React state, so it can never disturb playback timing.
 */
export function useProgressPersistence({
  bookId,
  wordCount,
  isPlaying,
  snapshot,
}: ProgressPersistenceOptions): void {
  const latest = useRef({ snapshot, wordCount });
  useEffect(() => {
    latest.current = { snapshot, wordCount };
  });

  const save = useCallback(() => {
    const { wordIndex, wpm, finished } = latest.current.snapshot();
    void saveProgress({
      bookId,
      wordIndex,
      wordCount: latest.current.wordCount,
      wpm,
      finished,
      updatedAt: Date.now(),
    });
  }, [bookId]);

  useEffect(() => {
    if (!isPlaying) {
      save();
      return;
    }
    const timer = window.setInterval(save, SAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, save]);

  useEffect(() => {
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [save]);
}
