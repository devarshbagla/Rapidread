import { IconChevronLeft } from '@tabler/icons-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { punctuationPauses, RAMP_WPM_PER_INTERVAL, RAMP_WORD_INTERVAL } from '../../reader/pacing';
import {
  ACCENTS,
  clampWpm,
  PUNCTUATION_WEIGHT_MAX,
  PUNCTUATION_WEIGHT_MIN,
  PUNCTUATION_WEIGHT_STEP,
  WPM_MAX,
  WPM_MIN,
  WPM_STEP,
  type ChunkSize,
  type Settings,
} from '../../store/settings';
import { IconButton } from '../ui/IconButton';
import { Segmented } from '../ui/Segmented';
import { Slider } from '../ui/Slider';
import { Toggle } from '../ui/Toggle';
import './Settings.css';

interface SettingsScreenProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const CHUNK_OPTIONS: readonly { value: ChunkSize; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
];

export function SettingsScreen({ settings, onChange, onClose }: SettingsScreenProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const pauses = punctuationPauses(settings.defaultWpm, settings.punctuationWeight);
  const orpAvailable = settings.chunkSize === 1;

  return (
    <div
      className="settings"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      ref={panelRef}
      tabIndex={-1}
    >
      <header className="settings-head">
        <IconButton label="Close settings" onClick={onClose}>
          <IconChevronLeft size={20} stroke={1.5} aria-hidden="true" />
        </IconButton>
        <h1 className="settings-title">Settings</h1>
      </header>

      <div className="settings-body">
        <Row label="Accent color" hint="Used for the focus letter, progress and primary actions.">
            <div className="swatches" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={settings.accent === preset.id}
                aria-label={preset.label}
                title={preset.label}
                className="swatch"
                data-selected={settings.accent === preset.id}
                style={{ background: preset.value }}
                onClick={() => onChange({ accent: preset.id })}
              />
            ))}
          </div>
        </Row>

        <Row
          label="Word chunk size"
          hint="How many words appear at once. The focus letter only applies to single words."
        >
          <Segmented
            label="Word chunk size"
            value={settings.chunkSize}
            options={CHUNK_OPTIONS}
            onChange={(chunkSize) => onChange({ chunkSize })}
          />
        </Row>

        <Row
          label="Focus letter highlight"
          hint={
            orpAvailable
              ? 'Tints the optimal recognition point in the accent color.'
              : 'Available in 1-word mode only.'
          }
        >
          <Toggle
            label="Focus letter highlight"
            checked={settings.orpHighlight && orpAvailable}
            disabled={!orpAvailable}
            onChange={(orpHighlight) => onChange({ orpHighlight })}
          />
        </Row>

        <Row
          label="Default reading speed"
          hint="Where new books start. Change speed while reading by dragging sideways."
          value={`${settings.defaultWpm} wpm`}
        >
          <Slider
            label="Default reading speed in words per minute"
            valueText={`${settings.defaultWpm} words per minute`}
            min={WPM_MIN}
            max={WPM_MAX}
            step={WPM_STEP}
            value={settings.defaultWpm}
            onChange={(defaultWpm) => onChange({ defaultWpm: clampWpm(defaultWpm) })}
          />
        </Row>

        <Row
          label="Punctuation pauses"
          hint={
            settings.punctuationWeight === 0
              ? 'Off — every word gets the same time.'
              : `+${pauses.clause} ms after a comma, +${pauses.sentence} ms after a full stop at ${settings.defaultWpm} wpm.`
          }
          value={`${settings.punctuationWeight.toFixed(1)}×`}
        >
          <Slider
            label="Punctuation pause weighting"
            valueText={`${settings.punctuationWeight.toFixed(1)} times`}
            min={PUNCTUATION_WEIGHT_MIN}
            max={PUNCTUATION_WEIGHT_MAX}
            step={PUNCTUATION_WEIGHT_STEP}
            value={settings.punctuationWeight}
            onChange={(punctuationWeight) => onChange({ punctuationWeight })}
          />
        </Row>

        <Row
          label="Adaptive pacing"
          hint={`Speeds up by ${RAMP_WPM_PER_INTERVAL} wpm every ${RAMP_WORD_INTERVAL.toLocaleString()} words, up to twice the speed a book started at. Resets for every new book, and whenever you set the speed yourself.`}
        >
          <Toggle
            label="Adaptive pacing"
            checked={settings.adaptivePacing}
            onChange={(adaptivePacing) => onChange({ adaptivePacing })}
          />
        </Row>

        <section className="settings-section">
          <h2 className="settings-section-title">Controls</h2>
          <dl className="shortcuts">
            <Shortcut keys="Lower half" description="Click to start or stop" />
            <Shortcut keys="Drag sideways" description="Hold and move to change speed" />
            <Shortcut keys="Upper half" description="Click to look around and jump" />
            <Shortcut keys="Space" description="Start or stop" />
            <Shortcut keys="↑ / ↓" description={`Speed by ${WPM_STEP} wpm`} />
            <Shortcut keys="← / →" description="One word back or forward" />
            <Shortcut keys="Esc" description="Back to the library" />
          </dl>
        </section>

        <p className="settings-foot">
          Books, positions and settings are stored only in this browser. Nothing is uploaded.
        </p>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  hint: string;
  value?: string;
  children: ReactNode;
}

function Row({ label, hint, value, children }: RowProps) {
  return (
    <section className="settings-row">
      <div className="settings-row-text">
        <p className="settings-row-label">
          {label}
          {value === undefined ? null : <span className="settings-row-value mono">{value}</span>}
        </p>
        <p className="settings-row-hint">{hint}</p>
      </div>
      <div className="settings-row-control">{children}</div>
    </section>
  );
}

function Shortcut({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="shortcut">
      <dt className="shortcut-keys">{keys}</dt>
      <dd className="shortcut-description">{description}</dd>
    </div>
  );
}
