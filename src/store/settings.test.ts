import { describe, expect, it } from 'vitest';
import { ACCENTS, clampWpm, DEFAULT_SETTINGS, normalizeSettings, WPM_MAX, WPM_MIN } from './settings';

describe('normalizeSettings', () => {
  it('returns the defaults for missing or invalid records', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ accent: 'neon', chunkSize: 9, defaultWpm: 'fast' })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('keeps valid fields and repairs the rest', () => {
    expect(
      normalizeSettings({
        accent: 'coral',
        orpHighlight: false,
        chunkSize: 2,
        defaultWpm: 450,
        punctuationWeight: 1.5,
        adaptivePacing: true,
      }),
    ).toEqual({
      accent: 'coral',
      orpHighlight: false,
      chunkSize: 2,
      defaultWpm: 450,
      punctuationWeight: 1.5,
      adaptivePacing: true,
    });
  });

  it('has four named accent presets', () => {
    expect(ACCENTS.map((preset) => preset.id)).toEqual(['teal', 'amber', 'blue', 'coral']);
  });
});

describe('clampWpm', () => {
  it('keeps speeds inside the supported range', () => {
    expect(clampWpm(40)).toBe(WPM_MIN);
    expect(clampWpm(9_000)).toBe(WPM_MAX);
    expect(clampWpm(333.4)).toBe(333);
    expect(clampWpm(Number.NaN)).toBe(DEFAULT_SETTINGS.defaultWpm);
  });
});
