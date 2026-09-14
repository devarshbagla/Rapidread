import type { Chunk } from '../../reader/chunking';
import { splitAtOrp } from '../../reader/orp';

interface WordDisplayProps {
  chunk: Chunk;
  /** ORP highlighting only ever applies to a single word. */
  orpHighlight: boolean;
}

/**
 * The word stage. The ORP character sits in a fixed centre column, so the two
 * fixation ticks above and below it never move, whatever the word's length.
 *
 * There is deliberately no transition on anything in here: word-to-word is a
 * hard cut, because a cross-fade costs legibility at speed.
 */
export function WordDisplay({ chunk, orpHighlight }: WordDisplayProps) {
  const words = chunk.words.map((token) => token.text);
  const text = words.join(' ');
  const single = words.length === 1 && orpHighlight;
  const parts = single ? splitAtOrp(words[0] ?? '') : { before: '', focus: text, after: '' };

  return (
    <div className="word-stage">
      <span className="fixation" aria-hidden="true" />
      <div className="word" data-words={Math.min(words.length, 3)} aria-hidden="true">
        <span className="word-before">{parts.before}</span>
        <span className="word-focus" data-orp={single}>
          {parts.focus}
        </span>
        <span className="word-after">{parts.after}</span>
      </div>
      <span className="fixation" aria-hidden="true" />
    </div>
  );
}
