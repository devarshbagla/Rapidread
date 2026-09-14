import { useEffect, useRef } from 'react';
import type { BookSummary } from '../store/types';
import './BookOpenTransition.css';

const DURATION_MS = 200;

interface BookOpenTransitionProps {
  book: BookSummary;
  /** Where the tile was when it was clicked. */
  origin: DOMRect;
  onDone: () => void;
}

/**
 * Shared-element hand-off from shelf tile to Reader: the tile grows to fill the
 * viewport and fades out over the Reader's own entrance. Scaling a
 * viewport-sized element keeps this on the compositor.
 */
export function BookOpenTransition({ book, origin, onDone }: BookOpenTransitionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof element.animate !== 'function') {
      onDoneRef.current();
      return;
    }

    const scaleX = origin.width / Math.max(window.innerWidth, 1);
    const scaleY = origin.height / Math.max(window.innerHeight, 1);
    const animation = element.animate(
      [
        {
          transform: `translate(${origin.left}px, ${origin.top}px) scale(${scaleX}, ${scaleY})`,
          opacity: 1,
        },
        { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 0 },
      ],
      { duration: DURATION_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' },
    );

    const onEnd = () => onDoneRef.current();
    animation.addEventListener('finish', onEnd);
    return () => {
      animation.removeEventListener('finish', onEnd);
      animation.cancel();
    };
  }, [origin]);

  return (
    <div className="book-open" ref={ref} aria-hidden="true">
      {book.coverImage === undefined ? (
        <span className="book-open-title">{book.title}</span>
      ) : (
        <img className="book-open-cover" src={book.coverImage} alt="" />
      )}
    </div>
  );
}
