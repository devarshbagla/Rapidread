import { describe, expect, it } from 'vitest';
import {
  easeInCubic,
  TUTORIAL_END_WPM,
  TUTORIAL_START_WPM,
  tutorialWpm,
} from './speedRamp';
import { buildTutorialFlatBook } from './tutorialBook';
import { TUTORIAL_SCRIPT } from './tutorialScript';

describe('easeInCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeInCubic(0)).toBe(0);
    expect(easeInCubic(1)).toBe(1);
  });

  it('stays below the linear midpoint early on', () => {
    expect(easeInCubic(0.5)).toBeLessThan(0.5);
  });
});

describe('tutorialWpm', () => {
  it('starts at 200 and ends at 700', () => {
    expect(tutorialWpm(0, 100)).toBe(TUTORIAL_START_WPM);
    expect(tutorialWpm(99, 100)).toBe(TUTORIAL_END_WPM);
  });

  it('ramps below the linear midpoint at halfway', () => {
    const mid = tutorialWpm(50, 101);
    const linearMid = (TUTORIAL_START_WPM + TUTORIAL_END_WPM) / 2;
    expect(mid).toBeLessThan(linearMid);
  });
});

describe('tutorial book', () => {
  it('tokenizes the exact script through the shared pipeline', () => {
    const flat = buildTutorialFlatBook();
    expect(flat.wordCount).toBeGreaterThan(100);
    expect(flat.words[0]?.text).toBe('hey,');
    expect(flat.words.at(-1)?.text).toBe('read.');
    // Script text must survive tokenization without alteration of tokens.
    expect(flat.words.map((token) => token.text).join(' ')).toBe(
      TUTORIAL_SCRIPT.replace(/\s+/g, ' ').trim(),
    );
  });
});
