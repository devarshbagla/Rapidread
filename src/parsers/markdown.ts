/**
 * Lightweight Markdown → plain text. Enough for reading: strips common markup
 * without pulling in a full Markdown engine.
 */

const FENCED_CODE = /```[^\n]*\n([\s\S]*?)```/g;
const IMAGE = /!\[([^\]]*)\]\([^)]+\)/g;
const LINK = /\[([^\]]+)\]\([^)]+\)/g;
const HEADING = /^#{1,6}\s+/gm;
const BLOCKQUOTE = /^>\s?/gm;
const HORIZONTAL_RULE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/gm;
const EMPHASIS = /(\*\*|__)(.*?)\1/g;
const ITALIC = /(\*|_)(.*?)\1/g;
const INLINE_CODE = /`([^`]+)`/g;
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm;

export function markdownToText(source: string): string {
  return source
    .replace(FENCED_CODE, '$1')
    .replace(IMAGE, '$1')
    .replace(LINK, '$1')
    .replace(HEADING, '')
    .replace(BLOCKQUOTE, '')
    .replace(HORIZONTAL_RULE, '')
    .replace(EMPHASIS, '$2')
    .replace(ITALIC, '$2')
    .replace(INLINE_CODE, '$1')
    .replace(LIST_MARKER, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
