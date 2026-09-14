import { useEffect, useState } from 'react';

interface SpeedReadoutProps {
  wpm: number;
  x: number;
  y: number;
  /** After release the number lingers, then fades out. */
  releasing: boolean;
}

const OFFSET_X = 18;
const OFFSET_Y = 34;
const WIDTH = 92;

/** Floating WPM number shown next to the cursor during a speed drag. */
export function SpeedReadout({ wpm, x, y, releasing }: SpeedReadoutProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const left = Math.min(Math.max(x + OFFSET_X, 8), Math.max(window.innerWidth - WIDTH, 8));
  const top = Math.min(Math.max(y - OFFSET_Y, 8), Math.max(window.innerHeight - 40, 8));

  return (
    <div
      className="speed-readout mono"
      data-shown={shown && !releasing}
      data-releasing={releasing}
      style={{ left, top }}
      aria-hidden="true"
    >
      {wpm} <span className="speed-readout-unit">wpm</span>
    </div>
  );
}
