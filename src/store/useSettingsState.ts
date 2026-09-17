import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSettingsRecord, saveSettings } from './db';
import {
  accentValue,
  DEFAULT_SETTINGS,
  normalizeSettings,
  type Settings,
} from './settings';
import { pullSettings, pushSettings } from '../sync/api';
import { onSessionChange } from '../sync/session';

export interface SettingsApi {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => void;
}

export function useSettingsState(): SettingsApi {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const current = useRef(settings);
  const updatedAt = useRef(0);

  useEffect(() => {
    let active = true;
    void loadSettingsRecord().then((stored) => {
      if (!active) return;
      current.current = stored.settings;
      updatedAt.current = stored.updatedAt;
      setSettings(stored.settings);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentValue(settings.accent));
  }, [settings.accent]);

  const syncFromCloud = useCallback(async () => {
    const remote = await pullSettings();
    if (remote === undefined || remote.settings === null) {
      void pushSettings(current.current, updatedAt.current || Date.now());
      return;
    }
    if (remote.updatedAt > updatedAt.current) {
      current.current = remote.settings;
      updatedAt.current = remote.updatedAt;
      setSettings(remote.settings);
      await saveSettings(remote.settings, remote.updatedAt);
    } else {
      void pushSettings(current.current, updatedAt.current || Date.now());
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void syncFromCloud();
    return onSessionChange(() => void syncFromCloud());
  }, [ready, syncFromCloud]);

  const update = useCallback((patch: Partial<Settings>) => {
    const next = normalizeSettings({ ...current.current, ...patch });
    current.current = next;
    updatedAt.current = Date.now();
    setSettings(next);
    void saveSettings(next, updatedAt.current);
    void pushSettings(next, updatedAt.current);
  }, []);

  return { settings, ready, update };
}
