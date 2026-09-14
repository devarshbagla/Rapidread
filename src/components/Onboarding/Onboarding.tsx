import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { buildTutorialFlatBook } from '../../onboarding/tutorialBook';
import { tutorialWpm, TUTORIAL_START_WPM } from '../../onboarding/speedRamp';
import { useRsvpEngine } from '../../reader/useRsvpEngine';
import { WordDisplay } from '../Reader/WordDisplay';
import '../Reader/Reader.css';
import './Onboarding.css';

interface OnboardingProps {
  onComplete: () => void;
}

/**
 * First-launch tutorial: the real RSVP engine + WordDisplay, fed a special
 * in-memory book. Auto-ramps 200→700 WPM unless the user prefers reduced motion,
 * in which case each tap advances one word.
 */
export function Onboarding({ onComplete }: OnboardingProps) {
  const reducedMotion = usePrefersReducedMotion();
  const book = useMemo(() => buildTutorialFlatBook(), []);
  const completed = useRef(false);

  const engine = useRsvpEngine({
    book,
    chunkSize: 1,
    punctuationWeight: 1,
    adaptivePacing: false,
    initialIndex: 0,
    initialWpm: TUTORIAL_START_WPM,
    initialFinished: false,
  });

  const { play, pause, setWpm, step, index, baselineWpm, finished, wpm, chunk } = engine;

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    pause();
    onComplete();
  }, [onComplete, pause]);

  // Drive the ease-in ramp from word progress. Adaptive pacing stays off.
  useEffect(() => {
    if (reducedMotion) return;
    const next = tutorialWpm(index, book.wordCount);
    if (next !== baselineWpm) setWpm(next);
  }, [baselineWpm, book.wordCount, index, reducedMotion, setWpm]);

  useEffect(() => {
    if (reducedMotion) return;
    play();
  }, [play, reducedMotion]);

  useEffect(() => {
    if (finished) finish();
  }, [finished, finish]);

  const advanceOnce = useCallback(() => {
    if (completed.current) return;
    if (index >= book.wordCount - 1) {
      finish();
      return;
    }
    step(1);
  }, [book.wordCount, finish, index, step]);

  const onSurfaceActivate = useCallback(() => {
    if (!reducedMotion) return;
    advanceOnce();
  }, [advanceOnce, reducedMotion]);

  return (
    <div className="onboarding reader" data-wpm={wpm} data-reduced-motion={reducedMotion}>
      <button type="button" className="onboarding-skip" onClick={finish}>
        skip
      </button>

      <div className="reader-word">
        <WordDisplay chunk={chunk} orpHighlight />
      </div>

      {/* Catch taps for reduced-motion advance; ignore during auto-play. */}
      <div
        className="reader-surface"
        role={reducedMotion ? 'button' : undefined}
        tabIndex={reducedMotion ? 0 : undefined}
        aria-label={reducedMotion ? 'Show next word' : undefined}
        onClick={onSurfaceActivate}
        onKeyDown={(event) => {
          if (!reducedMotion) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            advanceOnce();
          }
        }}
      />

      {reducedMotion ? (
        <p className="onboarding-hint" aria-hidden="true">
          tap to continue
        </p>
      ) : (
        <p className="onboarding-wpm mono" aria-hidden="true">
          {wpm} <span className="onboarding-wpm-unit">wpm</span>
        </p>
      )}

      <p className="sr-only" role="status">
        {reducedMotion
          ? 'Tutorial. Tap to advance through each word.'
          : `Tutorial reading at ${wpm} words per minute.`}
      </p>
    </div>
  );
}
