import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSettings, saveSettings } from './db';
import {
  accentValue,
  DEFAULT_SETTINGS,
  normalizeSettings,
  type Settings,
} from './settings';

export interface SettingsApi {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

export function useSettingsState(): SettingsApi {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const current = useRef(settings);

  useEffect(() => {
    let active = true;
    void loadSettings().then((stored) => {
      if (!active) return;
      current.current = stored;
      setSettings(stored);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // The accent is a single custom property, so switching it is one write.
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentValue(settings.accent));
  }, [settings.accent]);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = normalizeSettings({ ...current.current, ...patch });
    current.current = next;
    setSettings(next);
    void saveSettings(next);
  }, []);

  return { settings, ready, update };
}
