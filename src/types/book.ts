/**
 * The normalized book format: the single shape every parser must produce and
 * the only shape the reader engine, the store and the UI are allowed to see.
 *
 * Adding a format (PDF, DOCX, …) means adding a parser that returns a
 * `NormalizedBook`. Nothing downstream of `src/parsers/` changes.
 */

export interface Token {
  /** The word as displayed, punctuation included. */
  text: string;
  /** Trailing punctuation closes a sentence (`.`, `!`, `?`, `…`). */
  isSentenceEnd: boolean;
  /** Trailing punctuation closes a clause (`,`, `;`, `:`, dashes). */
  isClauseEnd: boolean;
}

export interface Chapter {
  title: string;
  tokens: Token[];
}

export interface NormalizedBook {
  title: string;
  author?: string;
  /** Data URL, so a book is a single self-contained record in IndexedDB. */
  coverImage?: string;
  chapters: Chapter[];
}
