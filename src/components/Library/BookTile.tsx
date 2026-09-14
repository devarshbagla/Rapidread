import { IconCheck, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { isStarted, progressFraction, type BookSummary, type ReadingProgress } from '../../store/types';
import { IconButton } from '../ui/IconButton';

interface BookTileProps {
  book: BookSummary;
  progress: ReadingProgress | undefined;
  onOpen: (origin: DOMRect) => void;
  onRemove: () => void;
}

export function BookTile({ book, progress, onOpen, onRemove }: BookTileProps) {
  const [confirming, setConfirming] = useState(false);
  const finished = progress?.finished === true;
  const reading = isStarted(progress);
  const percent = Math.round(progressFraction(progress) * 100);

  const state = finished ? ', finished' : reading ? `, ${percent}% read` : '';
  const label = `Open ${book.title}${book.author === undefined ? '' : ` by ${book.author}`}${state}`;

  return (
    <div className="tile-wrap">
      <div className="tile-frame" data-finished={finished} data-reading={reading}>
        <button
          type="button"
          className="tile"
          aria-label={label}
          onClick={(event) => onOpen(event.currentTarget.getBoundingClientRect())}
        >
          {book.coverImage === undefined ? (
            <span className="tile-text">{book.title}</span>
          ) : (
            <img className="tile-cover" src={book.coverImage} alt="" />
          )}
        </button>

        {finished ? (
          <span className="tile-badge">
            <IconCheck size={13} stroke={1.5} aria-hidden="true" />
          </span>
        ) : null}

        <IconButton
          className="icon-button tile-remove"
          label={`Remove ${book.title} from the shelf`}
          onClick={() => setConfirming(true)}
        >
          <IconTrash size={14} stroke={1.5} aria-hidden="true" />
        </IconButton>

        {confirming ? (
          <div className="tile-confirm">
            <p>Remove from shelf?</p>
            <div className="tile-confirm-actions">
              <button type="button" className="text-button" onClick={onRemove}>
                Remove
              </button>
              <button type="button" className="ghost-button" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <p className="tile-caption">{book.title}</p>
      {finished ? (
        <p className="tile-meta">Finished</p>
      ) : reading ? (
        <p className="tile-meta mono">{percent}%</p>
      ) : book.author !== undefined ? (
        <p className="tile-meta">{book.author}</p>
      ) : null}
    </div>
  );
}
