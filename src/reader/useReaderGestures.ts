import {
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { clampWpm } from '../store/settings';

/** Horizontal travel that turns a press into a speed drag. */
export const DRAG_THRESHOLD_PX = 9;
/** Dead strip along the left/right edges, left to the browser. */
export const EDGE_GUARD_PX = 24;
/** ~20px of travel is ~10 WPM. */
export const WPM_PER_PIXEL = 0.5;
/** Drag lands on round numbers so the readout doesn't jitter. */
export const DRAG_WPM_STEP = 5;

export interface SpeedDragPosition {
  wpm: number;
  x: number;
  y: number;
}

export interface ReaderGestureOptions {
  enabled: boolean;
  /** Read at press time so the drag is relative to the current speed. */
  getWpm: () => number;
  onTopTap: () => void;
  onBottomTap: () => void;
  onSpeedDragStart: () => void;
  onSpeedDragMove: (position: SpeedDragPosition) => void;
  onSpeedDragEnd: (wpm: number) => void;
}

export interface GestureSurfaceProps {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
}

/** Displacement from the press point maps to a speed delta, not an absolute. */
export function wpmFromDrag(startWpm: number, deltaX: number): number {
  const raw = startWpm + deltaX * WPM_PER_PIXEL;
  return clampWpm(Math.round(raw / DRAG_WPM_STEP) * DRAG_WPM_STEP);
}

interface ActivePointer {
  id: number;
  startX: number;
  zone: 'top' | 'bottom';
  startWpm: number;
  dragging: boolean;
  lastWpm: number;
}

/**
 * The Reader's only pointer input: the top half opens preview, the bottom half
 * toggles playback, and a horizontal drag in the bottom half scrubs speed.
 * Vertical movement is ignored on purpose — only horizontal travel decides
 * whether a press was a tap or a drag.
 */
export function useReaderGestures(options: ReaderGestureOptions): GestureSurfaceProps {
  const active = useRef<ActivePointer | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!options.enabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (
      event.clientX < EDGE_GUARD_PX ||
      event.clientX > window.innerWidth - EDGE_GUARD_PX
    ) {
      return;
    }

    const startWpm = options.getWpm();
    active.current = {
      id: event.pointerId,
      startX: event.clientX,
      zone: event.clientY < window.innerHeight / 2 ? 'top' : 'bottom',
      startWpm,
      dragging: false,
      lastWpm: startWpm,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = active.current;
    if (pointer === null || pointer.id !== event.pointerId) return;

    const deltaX = event.clientX - pointer.startX;
    if (!pointer.dragging) {
      if (pointer.zone !== 'bottom' || Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;
      pointer.dragging = true;
      options.onSpeedDragStart();
    }

    pointer.lastWpm = wpmFromDrag(pointer.startWpm, deltaX);
    options.onSpeedDragMove({ wpm: pointer.lastWpm, x: event.clientX, y: event.clientY });
  };

  const finish = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const pointer = active.current;
    if (pointer === null || pointer.id !== event.pointerId) return;
    active.current = null;

    if (pointer.dragging) {
      const wpm = cancelled ? pointer.lastWpm : wpmFromDrag(pointer.startWpm, event.clientX - pointer.startX);
      options.onSpeedDragEnd(wpm);
      return;
    }
    if (cancelled) return;
    if (Math.abs(event.clientX - pointer.startX) >= DRAG_THRESHOLD_PX) return;

    if (pointer.zone === 'top') options.onTopTap();
    else options.onBottomTap();
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (event) => finish(event, false),
    onPointerCancel: (event) => finish(event, true),
    onContextMenu: (event) => event.preventDefault(),
  };
}
