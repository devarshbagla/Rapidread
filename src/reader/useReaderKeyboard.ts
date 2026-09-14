import { useEffect, useRef } from 'react';

export interface ReaderKeyboardOptions {
  enabled: boolean;
  onToggle: () => void;
  onFaster: () => void;
  onSlower: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onExit: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Desktop shortcuts for the Reader: space, arrows, escape. */
export function useReaderKeyboard(options: ReaderKeyboardOptions): void {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const handlers = latest.current;
      if (!handlers.enabled) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          handlers.onToggle();
          break;
        case 'ArrowUp':
          event.preventDefault();
          handlers.onFaster();
          break;
        case 'ArrowDown':
          event.preventDefault();
          handlers.onSlower();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          handlers.onStepBack();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handlers.onStepForward();
          break;
        case 'Escape':
          handlers.onExit();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
