import { describe, expect, it } from 'vitest';
import { WPM_MAX, WPM_MIN } from '../store/settings';
import { wpmFromDrag } from './useReaderGestures';

describe('wpmFromDrag', () => {
  it('maps 20px of travel to 10 wpm', () => {
    expect(wpmFromDrag(300, 20)).toBe(310);
    expect(wpmFromDrag(300, -20)).toBe(290);
  });

  it('rounds to a 5 wpm step', () => {
    expect(wpmFromDrag(300, 4)).toBe(300);
    expect(wpmFromDrag(300, 12)).toBe(305);
  });

  it('clamps to the allowed range', () => {
    expect(wpmFromDrag(300, 10_000)).toBe(WPM_MAX);
    expect(wpmFromDrag(300, -10_000)).toBe(WPM_MIN);
  });

  it('is relative to the press point, not the screen position', () => {
    // +40px from x=80 and +40px from x=900 must produce the same delta.
    expect(wpmFromDrag(300, 40)).toBe(wpmFromDrag(300, 40));
    expect(wpmFromDrag(240, 40)).toBe(260);
    expect(wpmFromDrag(500, 40)).toBe(520);
  });
});
