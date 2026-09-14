import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChapterSpan, FlatBook } from '../../reader/flatten';
import { chunkDurationMs } from '../../reader/pacing';
import { useBookContent } from '../../reader/useBookContent';
import { useProgressPersistence } from '../../reader/useProgressPersistence';
import { useReaderGestures, type SpeedDragPosition } from '../../reader/useReaderGestures';
import { useReaderKeyboard } from '../../reader/useReaderKeyboard';
import { useRsvpEngine } from '../../reader/useRsvpEngine';
import { loadFlag, saveFlag } from '../../store/db';
import { clampWpm, WPM_STEP, type Settings } from '../../store/settings';
import type { ReadingProgress } from '../../store/types';
import { PreviewOverlay } from './PreviewOverlay';
import { SpeedReadout } from './SpeedReadout';
import { ReaderTopBar } from './ReaderTopBar';
import { useClickPulse } from './useClickPulse';
import { WordDisplay } from './WordDisplay';
import './Reader.css';

const HINT_FLAG = 'reader-hint-seen';
const HINT_DURATION_MS = 7000;
const READOUT_LINGER_MS = 1400;

interface ReaderProps {
  bookId: string;
  title: string;
  settings: Settings;
  /** True while Settings is on top: playback stays paused and keys are inert. */
  suspended: boolean;
  /** Opened from the shelf, so the entrance transition should play. */
  entering: boolean;
  onExit: () => void;
  onOpenSettings: () => void;
}

export function Reader(props: ReaderProps) {
  const content = useBookContent(props.bookId);

  if (content.status === 'loading') {
    return (
      <div className="reader">
        <ReaderTopBar onBack={props.onExit} onOpenSettings={props.onOpenSettings} />
      </div>
    );
  }

  if (content.status === 'missing') {
    return (
      <div className="reader">
        <ReaderTopBar onBack={props.onExit} onOpenSettings={props.onOpenSettings} />
        <div className="reader-notice">
          <p>This book is no longer stored on this device.</p>
          <button type="button" className="text-button" onClick={props.onExit}>
            Back to library
          </button>
        </div>
      </div>
    );
  }

  return <ReaderStage {...props} book={content.book} progress={content.progress} />;
}

interface ReaderStageProps extends ReaderProps {
  book: FlatBook;
  progress: ReadingProgress | undefined;
}

function ReaderStage({
  book,
  progress,
  bookId,
  title,
  settings,
  suspended,
  entering,
  onExit,
  onOpenSettings,
}: ReaderStageProps) {
  // Only the value at mount matters; the class drives a one-shot animation.
  const [playEntrance] = useState(entering);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [readout, setReadout] = useState<SpeedDragPosition | null>(null);
  const [readoutFading, setReadoutFading] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const readoutTimer = useRef<number | undefined>(undefined);

  const engine = useRsvpEngine({
    book,
    chunkSize: settings.chunkSize,
    punctuationWeight: settings.punctuationWeight,
    adaptivePacing: settings.adaptivePacing,
    initialIndex: progress?.wordIndex ?? 0,
    initialWpm: progress?.wpm ?? settings.defaultWpm,
    initialFinished: progress?.finished ?? false,
  });
  const { pulseRef, pulse } = useClickPulse();

  useProgressPersistence({
    bookId,
    wordCount: book.wordCount,
    isPlaying: engine.isPlaying,
    snapshot: engine.snapshot,
  });

  const { pause } = engine;

  useEffect(() => {
    if (suspended) pause();
  }, [suspended, pause]);

  // Reading in a hidden tab would silently burn through the book.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [pause]);

  // The Reader has no visible controls, so say once how it works.
  useEffect(() => {
    let active = true;
    void loadFlag(HINT_FLAG).then((seen) => {
      if (!active || seen) return;
      setHintVisible(true);
      void saveFlag(HINT_FLAG, true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hintVisible) return;
    const timer = window.setTimeout(() => setHintVisible(false), HINT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [hintVisible]);

  useEffect(() => () => window.clearTimeout(readoutTimer.current), []);

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

  const surface = useReaderGestures({
    enabled: !previewOpen && !suspended && !engine.finished,
    getWpm: () => engine.wpm,
    onTopTap: () => {
      pulse();
      engine.pause();
      setPreviewOpen(true);
    },
    onBottomTap: () => {
      pulse();
      engine.toggle();
    },
    onSpeedDragStart: () => {
      window.clearTimeout(readoutTimer.current);
      setReadoutFading(false);
      engine.setFrozen(true);
    },
    onSpeedDragMove: showReadout,
    onSpeedDragEnd: (wpm) => {
      engine.setWpm(wpm);
      engine.setFrozen(false);
      engine.play();
      fadeReadout();
    },
  });

  const nudgeWpm = (delta: number) => {
    const next = clampWpm(engine.wpm + delta);
    engine.setWpm(next);
    showReadout({ wpm: next, x: window.innerWidth / 2, y: window.innerHeight * 0.74 });
    fadeReadout();
  };

  useReaderKeyboard({
    enabled: !suspended,
    onToggle: () => {
      if (previewOpen) return;
      engine.toggle();
    },
    onFaster: () => nudgeWpm(WPM_STEP),
    onSlower: () => nudgeWpm(-WPM_STEP),
    onStepBack: () => engine.step(-1),
    onStepForward: () => engine.step(1),
    onExit: () => {
      if (previewOpen) setPreviewOpen(false);
      else onExit();
    },
  });

  const percent = Math.round(engine.fraction * 100);
  const statusVisible = !engine.isPlaying && !engine.finished && !previewOpen && !suspended;
  const chapterLabel = chapterLabelFor(engine.chapter, book.chapters.length);
  const announcement = engine.finished
    ? `You have finished ${title}.`
    : engine.isPlaying
      ? 'Reading.'
      : `Paused at ${percent} percent, ${engine.wpm} words per minute.`;

  return (
    <div
      className="reader"
      data-entering={playEntrance}
      data-wpm={engine.wpm}
      data-baseline-wpm={engine.baselineWpm}
      data-words-read={engine.wordsSinceBaseline}
      data-chunk-size={settings.chunkSize}
      data-chunk-ms={chunkDurationMs({
        wpm: engine.wpm,
        chunkWordCount: Math.max(1, engine.chunk.end - engine.chunk.start),
        endsSentence: engine.chunk.endsSentence,
        endsClause: engine.chunk.endsClause,
        punctuationWeight: settings.punctuationWeight,
      })}
      data-ends-clause={engine.chunk.endsClause}
      data-ends-sentence={engine.chunk.endsSentence}
      data-orp={settings.orpHighlight && settings.chunkSize === 1}
      data-adaptive={settings.adaptivePacing}
    >
      <ReaderTopBar onBack={onExit} onOpenSettings={onOpenSettings} />

      {previewOpen || suspended ? null : (
        <div className="reader-word">
          <WordDisplay
            chunk={engine.chunk}
            orpHighlight={settings.orpHighlight && settings.chunkSize === 1}
          />
        </div>
      )}

      {/* The whole viewport is the control: top half previews, bottom half plays. */}
      <div className="reader-surface" {...surface} />

      <div className="reader-status" data-visible={statusVisible} aria-hidden={!statusVisible}>
        <div className="reader-status-body">
          {hintVisible ? (
            <p className="reader-hint">
              Click the lower half to start and stop · hold and drag sideways to change speed ·
              click the upper half to look around
            </p>
          ) : null}
          <p className="reader-chapter">{chapterLabel}</p>
          <p className="reader-meta mono">
            Paused · {percent}% · {engine.wpm} wpm
          </p>
        </div>
        <div className="reader-progress">
          <span className="reader-progress-fill" style={{ width: `${engine.fraction * 100}%` }} />
        </div>
      </div>

      {readout !== null ? (
        <SpeedReadout wpm={readout.wpm} x={readout.x} y={readout.y} releasing={readoutFading} />
      ) : null}

      {previewOpen ? (
        <PreviewOverlay
          book={book}
          index={engine.index}
          chapter={engine.chapter}
          onJump={(wordIndex) => {
            pulse();
            engine.seek(wordIndex);
            setPreviewOpen(false);
          }}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      {engine.finished ? (
        <div className="reader-finished">
          <p className="reader-finished-title">You’ve finished {title}</p>
          <div className="reader-finished-actions">
            <button type="button" className="text-button" onClick={engine.restart}>
              Read again
            </button>
            <button type="button" className="ghost-button" onClick={onExit}>
              Back to library
            </button>
          </div>
        </div>
      ) : null}

      <div className="reader-pulse" ref={pulseRef} aria-hidden="true" />
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </div>
  );
}

function chapterLabelFor(chapter: ChapterSpan, chapterCount: number): string {
  if (chapterCount <= 1) return chapter.title;
  const position = `${chapter.index + 1} of ${chapterCount}`;
  return chapter.title.length > 0 ? `${chapter.title} · ${position}` : position;
}
