import { useCallback, useEffect, useState } from 'react';
import { BookOpenTransition } from './components/BookOpenTransition';
import { Library } from './components/Library/Library';
import { Onboarding } from './components/Onboarding/Onboarding';
import { Reader } from './components/Reader/Reader';
import { SettingsScreen } from './components/Settings/SettingsScreen';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { loadFlag, saveFlag } from './store/db';
import type { BookSummary } from './store/types';
import { useLibrary, type LibraryApi } from './store/useLibrary';
import { useSettingsState } from './store/useSettingsState';

/** Persisted once the first-launch tutorial finishes or is skipped. */
export const ONBOARDING_FLAG = 'rapidread_onboarded';
/** The tutorial already covers the three reader moves. */
const READER_HINT_FLAG = 'reader-hint-seen';

type View =
  | { kind: 'boot' }
  | { kind: 'onboarding' }
  | { kind: 'library' }
  | { kind: 'reader'; bookId: string };

interface OpeningBook {
  book: BookSummary;
  origin: DOMRect;
}

export default function App() {
  const { settings, ready: settingsReady, update } = useSettingsState();
  const library = useLibrary();
  const reducedMotion = usePrefersReducedMotion();

  // `undefined` until the reader navigates: the first view is derived from what
  // storage says was last open, so the Reader is the default screen.
  const [chosenView, setChosenView] = useState<View | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [opening, setOpening] = useState<OpeningBook | null>(null);
  // `null` while the onboarding flag is still loading from storage.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void loadFlag(ONBOARDING_FLAG).then((seen) => {
      if (active) setOnboarded(seen);
    });
    return () => {
      active = false;
    };
  }, []);

  const ready = settingsReady && library.ready && onboarded !== null;
  const view = chosenView ?? initialView(ready, library, onboarded === true);

  const finishOnboarding = useCallback(() => {
    void saveFlag(ONBOARDING_FLAG, true);
    void saveFlag(READER_HINT_FLAG, true);
    setOnboarded(true);
    setChosenView({ kind: 'library' });
  }, []);

  const openBook = useCallback(
    (book: BookSummary, origin: DOMRect) => {
      library.rememberLastBook(book.id);
      if (!reducedMotion) setOpening({ book, origin });
      setChosenView({ kind: 'reader', bookId: book.id });
    },
    [library, reducedMotion],
  );

  const exitReader = useCallback(() => {
    setOpening(null);
    setChosenView({ kind: 'library' });
  }, []);

  const activeBook =
    view.kind === 'reader' ? library.books.find((book) => book.id === view.bookId) : undefined;

  if (view.kind === 'boot') return <div className="app-boot" />;

  if (view.kind === 'onboarding') {
    return <Onboarding onComplete={finishOnboarding} />;
  }

  return (
    <>
      {view.kind === 'library' ? (
        <Library
          library={library}
          onOpenBook={openBook}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      {view.kind === 'reader' ? (
        <Reader
          key={view.bookId}
          bookId={view.bookId}
          title={activeBook?.title ?? 'this book'}
          fingerprint={activeBook?.fingerprint}
          settings={settings}
          suspended={settingsOpen}
          entering={opening !== null}
          onExit={exitReader}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      {opening !== null ? (
        <BookOpenTransition
          book={opening.book}
          origin={opening.origin}
          onDone={() => setOpening(null)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsScreen
          settings={settings}
          onChange={update}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  );
}

function initialView(ready: boolean, library: LibraryApi, onboarded: boolean): View {
  if (!ready) return { kind: 'boot' };
  if (!onboarded) return { kind: 'onboarding' };
  const lastBookId = library.lastBookId;
  const exists = lastBookId !== undefined && library.books.some((book) => book.id === lastBookId);
  return exists ? { kind: 'reader', bookId: lastBookId } : { kind: 'library' };
}
