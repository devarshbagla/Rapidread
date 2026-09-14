/**
 * Import failures are always reported to the reader as a plain sentence that
 * says what happened and what to do about it. Stack traces and generic
 * "something went wrong" copy never reach the UI.
 */
export class ImportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ImportError';
  }
}

/** Quote a file name for use inside an error sentence. */
export function quoted(name: string): string {
  return `\u201c${name}\u201d`;
}

/**
 * Last line of defence: turn anything thrown during parsing into a sentence a
 * non-technical reader can act on.
 */
export function toImportError(error: unknown, fileName: string): ImportError {
  if (error instanceof ImportError) return error;
  return new ImportError(
    `${quoted(fileName)} couldn't be read. The file may be damaged — try re-downloading it, or use a different copy.`,
    { cause: error },
  );
}
