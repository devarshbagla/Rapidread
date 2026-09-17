import { IconPlus, IconSettings, IconUser, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPTED_FILE_TYPES, SUPPORTED_FORMATS_LABEL } from '../../parsers';
import { useAuth } from '../../store/AuthProvider';
import { loadFlag, saveFlag } from '../../store/db';
import type { LibraryApi } from '../../store/useLibrary';
import { progressFraction, type BookSummary } from '../../store/types';
import type { RemoteBook } from '../../sync/session';
import { IconButton } from '../ui/IconButton';
import { BookTile } from './BookTile';
import { useFileDrop } from './useFileDrop';
import '../Account/Account.css';
import './Library.css';

const EMAIL_NUDGE_FLAG = 'email-nudge-dismissed';

interface LibraryProps {
  library: LibraryApi;
  onOpenBook: (book: BookSummary, origin: DOMRect) => void;
  onOpenSettings: () => void;
}

export function Library({ library, onOpenBook, onOpenSettings }: LibraryProps) {
  const auth = useAuth();
  const { books, remoteBooks, progress, importing, failures, durable, importFiles, refreshProgress } =
    library;
  const inputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLInputElement>(null);
  const [resumeTarget, setResumeTarget] = useState<RemoteBook | undefined>(undefined);
  const [nudgeDismissed, setNudgeDismissed] = useState(true);

  useEffect(() => {
    void refreshProgress();
  }, [refreshProgress]);

  useEffect(() => {
    let active = true;
    void loadFlag(EMAIL_NUDGE_FLAG).then((dismissed) => {
      if (active) setNudgeDismissed(dismissed);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleFiles = useCallback(
    (files: File[]) => {
      void importFiles(files);
    },
    [importFiles],
  );
  const dragging = useFileDrop(handleFiles);

  const openPicker = () => inputRef.current?.click();
  const shelfIsEmpty = books.length === 0 && importing.length === 0 && remoteBooks.length === 0;
  const signedIn = auth.user !== undefined;
  const showEmailNudge =
    signedIn && auth.user !== undefined && (auth.user.email === null || !auth.user.emailVerified) && !nudgeDismissed;

  return (
    <div className="library">
      <header className="library-head">
        <div>
          <h1 className="library-title">Rapidread</h1>
          <p className="library-sub">
            {books.length === 0
              ? signedIn
                ? 'Nothing on this device yet'
                : 'Nothing on the shelf yet'
              : `${books.length} ${books.length === 1 ? 'book' : 'books'} · stored on this device${
                  signedIn ? ' · progress syncs' : ''
                }`}
          </p>
        </div>
        <div className="library-actions">
          <IconButton label={`Add a book (${SUPPORTED_FORMATS_LABEL})`} onClick={openPicker}>
            <IconPlus size={18} stroke={1.5} aria-hidden="true" />
          </IconButton>
          {auth.configured ? (
            <IconButton
              label={signedIn ? `Signed in as ${auth.user?.username}` : 'Sign in to sync'}
              onClick={onOpenSettings}
            >
              <IconUser size={18} stroke={1.5} aria-hidden="true" />
            </IconButton>
          ) : null}
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
        {showEmailNudge && auth.user !== undefined ? (
          <div className="account-nudge">
            <p>
              {auth.user.email === null
                ? 'Add an email while you still know this password. Forgot password only works with a confirmed address.'
                : 'Confirm your email so you can reset this password if you forget it.'}
            </p>
            <div className="account-nudge-actions">
              <button type="button" className="text-button" onClick={onOpenSettings}>
                Add email
              </button>
              <IconButton
                label="Dismiss this reminder"
                onClick={() => {
                  setNudgeDismissed(true);
                  void saveFlag(EMAIL_NUDGE_FLAG, true);
                }}
              >
                <IconX size={14} stroke={1.5} aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        ) : null}
      </div>

      {shelfIsEmpty ? (
        <div className="library-empty">
          <p className="library-empty-title">Your shelf is empty</p>
          <p className="library-empty-body">
            {signedIn
              ? `Add a book from this device to resume where you left off. Drag a ${SUPPORTED_FORMATS_LABEL} file anywhere onto this window.`
              : `Drag a ${SUPPORTED_FORMATS_LABEL} file anywhere onto this window, or add one directly. Books never leave your device.`}
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
          {remoteBooks.map((book) => (
            <RemoteTile
              key={book.fingerprint}
              book={book}
              onFind={() => {
                setResumeTarget(book);
                resumeRef.current?.click();
              }}
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
      <input
        ref={resumeRef}
        type="file"
        className="sr-only"
        accept={ACCEPTED_FILE_TYPES}
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file === undefined || resumeTarget === undefined) return;
          const target = resumeTarget;
          setResumeTarget(undefined);
          void library.resumeRemote(target, file).then((summary) => {
            if (summary !== undefined) {
              const origin = new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 1, 1);
              onOpenBook(summary, origin);
            }
          });
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

function RemoteTile({ book, onFind }: { book: RemoteBook; onFind: () => void }) {
  const percent =
    book.progress === null ? 0 : Math.round(progressFraction({
      bookId: book.fingerprint,
      wordIndex: book.progress.wordIndex,
      wordCount: book.progress.wordCount,
      wpm: book.progress.wpm,
      finished: book.progress.finished,
      updatedAt: book.progress.updatedAt,
    }) * 100);
  const state = book.progress?.finished === true ? 'finished' : percent > 0 ? `${percent}%` : 'on another device';

  return (
    <div className="tile-wrap">
      <div className="tile-frame" data-remote="true">
        <button
          type="button"
          className="tile"
          aria-label={`Find ${book.title} on this device`}
          onClick={onFind}
        >
          <span className="tile-text">{book.title}</span>
        </button>
      </div>
      <p className="tile-caption">{book.title}</p>
      <p className="tile-meta">{state} · find this file</p>
    </div>
  );
}
