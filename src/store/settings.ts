export type AccentId = 'teal' | 'amber' | 'blue' | 'coral';

export interface AccentPreset {
  id: AccentId;
  label: string;
  value: string;
}

export const ACCENTS: readonly AccentPreset[] = [
  { id: 'teal', label: 'Teal', value: '#2DD4BF' },
  { id: 'amber', label: 'Amber', value: '#F5A524' },
  { id: 'blue', label: 'Blue', value: '#3B82F6' },
  { id: 'coral', label: 'Coral', value: '#F87171' },
];

export type ChunkSize = 1 | 2 | 3;

export interface Settings {
  accent: AccentId;
  /** Highlight the optimal recognition point. 1-word mode only. */
  orpHighlight: boolean;
  chunkSize: ChunkSize;
  defaultWpm: number;
  /** Multiplier on the dwell added after punctuation. 0 disables it. */
  punctuationWeight: number;
  /** Ramp speed up as a book is read. */
  adaptivePacing: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  accent: 'teal',
  orpHighlight: true,
  chunkSize: 1,
  defaultWpm: 300,
  punctuationWeight: 1,
  adaptivePacing: false,
};

export const WPM_MIN = 100;
export const WPM_MAX = 1000;
export const WPM_STEP = 10;

export const PUNCTUATION_WEIGHT_MIN = 0;
export const PUNCTUATION_WEIGHT_MAX = 2;
export const PUNCTUATION_WEIGHT_STEP = 0.1;

export function accentValue(id: AccentId): string {
  return ACCENTS.find((preset) => preset.id === id)?.value ?? ACCENTS[0].value;
}

export function clampWpm(wpm: number): number {
  if (!Number.isFinite(wpm)) return DEFAULT_SETTINGS.defaultWpm;
  return Math.min(WPM_MAX, Math.max(WPM_MIN, Math.round(wpm)));
}

function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) return DEFAULT_SETTINGS.punctuationWeight;
  const stepped = Math.round(weight * 10) / 10;
  return Math.min(PUNCTUATION_WEIGHT_MAX, Math.max(PUNCTUATION_WEIGHT_MIN, stepped));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Read settings defensively: a stored record may predate any field, so every
 * value falls back to its default rather than trusting what is on disk.
 */
export function normalizeSettings(value: unknown): Settings {
  if (!isRecord(value)) return DEFAULT_SETTINGS;

  const accent = ACCENTS.some((preset) => preset.id === value.accent)
    ? (value.accent as AccentId)
    : DEFAULT_SETTINGS.accent;
  const chunkSize =
    value.chunkSize === 1 || value.chunkSize === 2 || value.chunkSize === 3
      ? value.chunkSize
      : DEFAULT_SETTINGS.chunkSize;

  return {
    accent,
    chunkSize,
    orpHighlight:
      typeof value.orpHighlight === 'boolean' ? value.orpHighlight : DEFAULT_SETTINGS.orpHighlight,
    defaultWpm:
      typeof value.defaultWpm === 'number' ? clampWpm(value.defaultWpm) : DEFAULT_SETTINGS.defaultWpm,
    punctuationWeight:
      typeof value.punctuationWeight === 'number'
        ? clampWeight(value.punctuationWeight)
        : DEFAULT_SETTINGS.punctuationWeight,
    adaptivePacing:
      typeof value.adaptivePacing === 'boolean'
        ? value.adaptivePacing
        : DEFAULT_SETTINGS.adaptivePacing,
  };
}
