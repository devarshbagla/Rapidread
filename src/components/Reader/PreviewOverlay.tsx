import { IconX } from '@tabler/icons-react';
import { useEffect, useMemo, useRef } from 'react';
import type { ChapterSpan, FlatBook } from '../../reader/flatten';
import { buildLines, lineIndexAt, lineText } from '../../reader/lines';
import { IconButton } from '../ui/IconButton';

/** Lines kept either side of the current one — far more than "nearby" needs. */
const LINE_WINDOW = 600;

interface PreviewOverlayProps {
  book: FlatBook;
  index: number;
  chapter: ChapterSpan;
  onJump: (wordIndex: number) => void;
  onClose: () => void;
}

/**
 * Preview mode: playback is already paused, and the surrounding lines are laid
 * out so a specific spot can be found and jumped to.
 */
export function PreviewOverlay({ book, index, chapter, onJump, onClose }: PreviewOverlayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);

  const lines = useMemo(
    () => buildLines(book.words, chapter.start, chapter.end),
    [book.words, chapter.start, chapter.end],
  );
  const currentLine = useMemo(() => lineIndexAt(lines, index), [lines, index]);

  const from = Math.max(0, currentLine - LINE_WINDOW);
  const to = Math.min(lines.length, currentLine + LINE_WINDOW);
  const visible = lines.slice(from, to);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
    scrollRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className="preview"
      role="dialog"
      aria-modal="true"
      aria-label="Preview and jump"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="preview-head">
        <span className="preview-chapter">{chapter.title}</span>
        <IconButton label="Close preview" onClick={onClose}>
          <IconX size={16} stroke={1.5} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="preview-scroll" ref={scrollRef} tabIndex={-1}>
        <div className="preview-lines">
          {visible.map((line, offset) => {
            const isCurrent = from + offset === currentLine;
            return (
              <button
                key={line.start}
                type="button"
                ref={isCurrent ? currentRef : undefined}
                className="preview-line"
                data-current={isCurrent}
                onClick={() => onJump(line.start)}
              >
                {lineText(book.words, line)}
              </button>
            );
          })}
        </div>
      </div>

      <p className="preview-foot">Click a line to jump there — reading stays paused.</p>
    </div>
  );
}
