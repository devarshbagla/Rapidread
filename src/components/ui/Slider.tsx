interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  valueText?: string;
}

/**
 * A native range input for behaviour and accessibility, with the visible track
 * drawn as flat elements — no gradients, no shadows.
 */
export function Slider({ value, min, max, step, onChange, label, valueText }: SliderProps) {
  const fraction = max === min ? 0 : (value - min) / (max - min);
  const percent = `${(fraction * 100).toFixed(2)}%`;

  return (
    <div className="slider">
      <input
        type="range"
        className="slider-input"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="slider-track" aria-hidden="true">
        <span className="slider-fill" style={{ width: percent }} />
      </span>
      <span className="slider-thumb" style={{ left: percent }} aria-hidden="true" />
    </div>
  );
}
