import { IconPlus, IconSettings, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useRef } from 'react';
import { ACCEPTED_FILE_TYPES, SUPPORTED_FORMATS_LABEL } from '../../parsers';
import type { LibraryApi } from '../../store/useLibrary';
import type { BookSummary } from '../../store/types';
import { IconButton } from '../ui/IconButton';
import { BookTile } from './BookTile';
import { useFileDrop } from './useFileDrop';
import './Library.css';

interface LibraryProps {
  library: LibraryApi;
  onOpenBook: (book: BookSummary, origin: DOMRect) => void;
  onOpenSettings: () => void;
}

export function Library({ library, onOpenBook, onOpenSettings }: LibraryProps) {
  const { books, progress, importing, failures, durable, importFiles, refreshProgress } = library;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refreshProgress();
  }, [refreshProgress]);

  const handleFiles = useCallback(
    (files: File[]) => {
      void importFiles(files);
    },
    [importFiles],
  );
  const dragging = useFileDrop(handleFiles);

  const openPicker = () => inputRef.current?.click();
  const shelfIsEmpty = books.length === 0 && importing.length === 0;

  return (
    <div className="library">
      <header className="library-head">
        <div>
          <h1 className="library-title">Rapidread</h1>
          <p className="library-sub">
            {books.length === 0
              ? 'Nothing on the shelf yet'
              : `${books.length} ${books.length === 1 ? 'book' : 'books'} · stored on this device`}
          </p>
        </div>
        <div className="library-actions">
          <IconButton label={`Add a book (${SUPPORTED_FORMATS_LABEL})`} onClick={openPicker}>
            <IconPlus size={18} stroke={1.5} aria-hidden="true" />
          </IconButton>
          <IconButton label="Settings" onClick={onOpenSettings}>
            <IconSettings size={18} stroke={1.5} aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      <div className="library-messages" aria-live="polite">
        {importing.map((name) => (
          <p className="library-note" key={name}>
            Importing “{name}”…
          </p>
        ))}
        {failures.map((failure) => (
          <div className="library-error" key={failure.id}>
            <p>{failure.message}</p>
            <IconButton label="Dismiss this message" onClick={() => library.dismissFailure(failure.id)}>
              <IconX size={14} stroke={1.5} aria-hidden="true" />
            </IconButton>
          </div>
        ))}
        {durable ? null : (
          <p className="library-note">
            This browser is blocking local storage, so books and reading positions will be lost when
            the tab closes.
          </p>
        )}
      </div>

      {shelfIsEmpty ? (
        <div className="library-empty">
          <p className="library-empty-title">Your shelf is empty</p>
          <p className="library-empty-body">
            Drag a {SUPPORTED_FORMATS_LABEL} file anywhere onto this window, or add one directly.
            Books never leave your device.
          </p>
          <button type="button" className="text-button" onClick={openPicker}>
            Add a book
          </button>
        </div>
      ) : (
        <div className="shelf">
          {books.map((book) => (
            <BookTile
              key={book.id}
              book={book}
              progress={progress[book.id]}
              onOpen={(origin) => onOpenBook(book, origin)}
              onRemove={() => void library.remove(book.id)}
            />
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={ACCEPTED_FILE_TYPES}
        multiple
        tabIndex={-1}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length > 0) handleFiles(files);
        }}
      />

      {dragging ? (
        <div className="drop-target" aria-hidden="true">
          <div className="drop-target-frame">
            <p className="drop-target-title">Drop to import</p>
            <p className="drop-target-body">{SUPPORTED_FORMATS_LABEL}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
