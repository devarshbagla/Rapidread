import { tokenize } from '../parsers/tokenize';
import { flattenBook, type FlatBook } from '../reader/flatten';
import type { NormalizedBook } from '../types/book';
import { TUTORIAL_SCRIPT } from './tutorialScript';

/** Build the tutorial as a normalized book so it shares the real token pipeline. */
export function buildTutorialBook(): NormalizedBook {
  return {
    title: 'rapidread',
    author: 'devarsh',
    chapters: [
      {
        title: '',
        tokens: tokenize(TUTORIAL_SCRIPT),
      },
    ],
  };
}

/** Flattened word stream for the RSVP engine. */
export function buildTutorialFlatBook(): FlatBook {
  return flattenBook(buildTutorialBook());
}
