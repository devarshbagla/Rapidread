import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import {
  COACH_WPM,
  coachChunkAt,
  coachTokens,
  type CoachKind,
} from '../../onboarding/coaching';
import { tutorialWpm, TUTORIAL_START_WPM } from '../../onboarding/speedRamp';
import { buildTutorialFlatBook } from '../../onboarding/tutorialBook';
import {
  useReaderGestures,
  type SpeedDragPosition,
} from '../../reader/useReaderGestures';
import { useReaderKeyboard } from '../../reader/useReaderKeyboard';
import { useRsvpEngine } from '../../reader/useRsvpEngine';
import { clampWpm, WPM_STEP } from '../../store/settings';
import { PreviewOverlay } from '../Reader/PreviewOverlay';
import { SpeedReadout } from '../Reader/SpeedReadout';
import { useClickPulse } from '../Reader/useClickPulse';
import { WordDisplay } from '../Reader/WordDisplay';
import '../Reader/Reader.css';
import './Onboarding.css';

const READOUT_LINGER_MS = 1400;

interface OnboardingProps {
  onComplete: () => void;
}

interface CoachState {
  kind: CoachKind;
  tokens: ReturnType<typeof coachTokens>;
  index: number;
}

/**
 * First-launch tutorial: real RSVP engine + the same pointer/keyboard controls
 * as the Reader. Auto-ramps 200→700 WPM; the first time each control is used a
 * short coaching RSVP confirms it, then the tutorial resumes.
 */
export function Onboarding({ onComplete }: OnboardingProps) {
  const reducedMotion = usePrefersReducedMotion();
  const book = useMemo(() => buildTutorialFlatBook(), []);

  const seen = useRef({ playPause: false, speed: false, step: false });
  const previewCoached = useRef(false);
  /** Once the user sets speed themselves, stop overriding with the auto ramp. */
  const userControlsSpeed = useRef(false);
  const resumeAfterCoach = useRef(false);
  const readoutTimer = useRef(0);

  const [done, setDone] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [coach, setCoach] = useState<CoachState | null>(null);
  const [readout, setReadout] = useState<SpeedDragPosition | null>(null);
  const [readoutFading, setReadoutFading] = useState(false);

  const engine = useRsvpEngine({
    book,
    chunkSize: 1,
    punctuationWeight: 1,
    adaptivePacing: false,
    initialIndex: 0,
    initialWpm: TUTORIAL_START_WPM,
    initialFinished: false,
  });

  const {
    play,
    pause,
    toggle,
    setWpm,
    setFrozen,
    step,
    seek,
    index,
    baselineWpm,
    finished,
    wpm,
    chunk,
    chapter,
    isPlaying,
  } = engine;

  const { pulseRef, pulse } = useClickPulse();
  const coaching = coach !== null;

  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    pause();
    onComplete();
  }, [done, onComplete, pause]);

  const beginCoach = useCallback(
    (kind: CoachKind, resume: boolean) => {
      pause();
      setPreviewOpen(false);
      resumeAfterCoach.current = resume;
      setCoach({ kind, tokens: coachTokens(kind), index: 0 });
    },
    [pause],
  );

  // Ease-in ramp — off after the user takes over speed, during coaching, or
  // when reduced motion is preferred.
  useEffect(() => {
    if (reducedMotion || coaching || userControlsSpeed.current) return;
    const next = tutorialWpm(index, book.wordCount);
    if (next !== baselineWpm) setWpm(next);
  }, [baselineWpm, book.wordCount, coaching, index, reducedMotion, setWpm]);

  useEffect(() => {
    if (reducedMotion || coaching || previewOpen || done) return;
    play();
  }, [coaching, done, play, previewOpen, reducedMotion]);

  useEffect(() => {
    if (finished) finish();
  }, [finished, finish]);

  useEffect(() => () => window.clearTimeout(readoutTimer.current), []);

  // Advance coaching aside word-by-word (timed, unless reduced motion).
  useEffect(() => {
    if (coach === null) return;

    if (coach.index >= coach.tokens.length) {
      const shouldResume = resumeAfterCoach.current;
      resumeAfterCoach.current = false;
      setCoach(null);
      // Reduced-motion users stay in manual control after a tip.
      if (shouldResume && !done && !reducedMotion) play();
      return;
    }

    if (reducedMotion) return;

    const delay = Math.max(24, 60_000 / COACH_WPM);
    const timer = window.setTimeout(() => {
      setCoach((current) =>
        current === null ? null : { ...current, index: current.index + 1 },
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [coach, done, play, reducedMotion]);

  const showReadout = useCallback((position: SpeedDragPosition) => {
    window.clearTimeout(readoutTimer.current);
    setReadoutFading(false);
    setReadout(position);
  }, []);

  const fadeReadout = useCallback(() => {
    setReadoutFading(true);
    readoutTimer.current = window.setTimeout(() => {
      setReadout(null);
      setReadoutFading(false);
    }, READOUT_LINGER_MS);
  }, []);

  const handleToggle = useCallback(() => {
    if (coaching || done) return;

    if (isPlaying) {
      pause();
      if (!seen.current.playPause) {
        seen.current.playPause = true;
        beginCoach('playPause', true);
        return;
      }
      return;
    }

    toggle();
  }, [beginCoach, coaching, done, isPlaying, pause, toggle]);

  const handleSpeedCommit = useCallback(
    (next: number) => {
      if (coaching || done) return;
      userControlsSpeed.current = true;
      setWpm(next);
      setFrozen(false);
      if (!seen.current.speed) {
        seen.current.speed = true;
        beginCoach('speed', true);
        return;
      }
      if (!reducedMotion) play();
    },
    [beginCoach, coaching, done, play, reducedMotion, setFrozen, setWpm],
  );

  const openPreview = useCallback(() => {
    if (coaching || done) return;
    pulse();
    pause();
    setPreviewOpen(true);
  }, [coaching, done, pause, pulse]);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    if (!previewCoached.current) {
      previewCoached.current = true;
      beginCoach('preview', true);
      return;
    }
    if (!reducedMotion) play();
  }, [beginCoach, play, reducedMotion]);

  const handleStep = useCallback(
    (delta: number) => {
      if (coaching || done || previewOpen) return;
      step(delta);
      if (!seen.current.step) {
        seen.current.step = true;
        beginCoach('step', true);
      }
    },
    [beginCoach, coaching, done, previewOpen, step],
  );

  const nudgeWpm = useCallback(
    (delta: number) => {
      if (coaching || done || previewOpen) return;
      const next = clampWpm(wpm + delta);
      userControlsSpeed.current = true;
      setWpm(next);
      showReadout({ wpm: next, x: window.innerWidth / 2, y: window.innerHeight * 0.74 });
      fadeReadout();
      if (!seen.current.speed) {
        seen.current.speed = true;
        beginCoach('speed', true);
      }
    },
    [beginCoach, coaching, done, fadeReadout, previewOpen, setWpm, showReadout, wpm],
  );

  const surface = useReaderGestures({
    enabled: !previewOpen && !coaching && !finished && !done,
    getWpm: () => wpm,
    onTopTap: openPreview,
    onBottomTap: () => {
      pulse();
      handleToggle();
    },
    onSpeedDragStart: () => {
      window.clearTimeout(readoutTimer.current);
      setReadoutFading(false);
      setFrozen(true);
    },
    onSpeedDragMove: showReadout,
    onSpeedDragEnd: (next) => {
      fadeReadout();
      handleSpeedCommit(next);
    },
  });

  useReaderKeyboard({
    enabled: !coaching && !done,
    onToggle: () => {
      if (previewOpen) return;
      handleToggle();
    },
    onFaster: () => nudgeWpm(WPM_STEP),
    onSlower: () => nudgeWpm(-WPM_STEP),
    onStepBack: () => handleStep(-1),
    onStepForward: () => handleStep(1),
    onExit: () => {
      if (previewOpen) closePreview();
      else finish();
    },
  });

  const advanceCoachTap = useCallback(() => {
    if (coach === null) return;
    if (coach.index >= coach.tokens.length - 1) {
      const shouldResume = resumeAfterCoach.current;
      resumeAfterCoach.current = false;
      setCoach(null);
      if (shouldResume && !done && !reducedMotion) play();
      return;
    }
    setCoach({ ...coach, index: coach.index + 1 });
  }, [coach, done, play, reducedMotion]);

  const displayChunk =
    coach !== null
      ? coachChunkAt(coach.tokens, Math.min(coach.index, Math.max(0, coach.tokens.length - 1)))
      : chunk;

  const showWord = !previewOpen;

  return (
    <div
      className="onboarding reader"
      data-wpm={wpm}
      data-reduced-motion={reducedMotion}
      data-coaching={coaching}
    >
      <button type="button" className="onboarding-skip" onClick={finish}>
        skip
      </button>

      {showWord ? (
        <div className="reader-word">
          <WordDisplay chunk={displayChunk} orpHighlight />
        </div>
      ) : null}

      <div className="reader-surface" {...surface} />

      {reducedMotion && !coaching && !previewOpen ? (
        <p className="onboarding-hint" aria-hidden="true">
          lower half play/pause · drag to change speed · upper half preview
        </p>
      ) : null}

      {!reducedMotion && !coaching && isPlaying ? (
        <p className="onboarding-wpm mono" aria-hidden="true">
          {wpm} <span className="onboarding-wpm-unit">wpm</span>
        </p>
      ) : null}

      {coaching ? (
        <p className="onboarding-coach-line" aria-hidden="true">
          {coach !== null ? coach.tokens.map((token) => token.text).join(' ') : ''}
        </p>
      ) : null}

      {coaching && reducedMotion ? (
        <button
          type="button"
          className="onboarding-hint onboarding-coach-tap"
          onClick={advanceCoachTap}
        >
          tap to continue
        </button>
      ) : null}

      {readout !== null ? (
        <SpeedReadout wpm={readout.wpm} x={readout.x} y={readout.y} releasing={readoutFading} />
      ) : null}

      {previewOpen ? (
        <PreviewOverlay
          book={book}
          index={index}
          chapter={chapter}
          onJump={(wordIndex) => {
            pulse();
            seek(wordIndex);
            closePreview();
          }}
          onClose={closePreview}
        />
      ) : null}

      <div className="reader-pulse" ref={pulseRef} aria-hidden="true" />

      <p className="sr-only" role="status">
        {coaching
          ? 'Tutorial tip.'
          : reducedMotion
            ? 'Tutorial. Use the reading controls to move through it.'
            : `Tutorial reading at ${wpm} words per minute.`}
      </p>
    </div>
  );
}
