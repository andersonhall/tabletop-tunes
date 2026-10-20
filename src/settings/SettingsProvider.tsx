import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useBackend } from "../backend/BackendProvider";
import type { SettingName } from "../backend/Backend";
import { resolveSetting } from "./resolveSetting";

export interface BooleanSetting {
  enabled: boolean;
  /** False until the setting is known (e.g. while sign-in or the account's value loads). */
  ready: boolean;
  saving: boolean;
  error?: string;
  set(on: boolean): Promise<void>;
}

interface SettingSpec {
  name: SettingName;
  storageKey: string;
  defaultValue: boolean;
}

const AUTO_PLAY: SettingSpec = { name: "autoPlay", storageKey: "tabletopTunes.autoPlay", defaultValue: true };
const SHUFFLE: SettingSpec = { name: "shuffle", storageKey: "tabletopTunes.shuffle", defaultValue: false };

function placeholder(spec: SettingSpec): BooleanSetting {
  return { enabled: spec.defaultValue, ready: false, saving: false, set: async () => {} };
}

const AutoPlayContext = createContext<BooleanSetting>(placeholder(AUTO_PLAY));
const ShuffleContext = createContext<BooleanSetting>(placeholder(SHUFFLE));

// localStorage can throw (private windows, blocked site data); the default covers that.
function readLocal(key: string): boolean | undefined {
  try {
    const v = localStorage.getItem(key);
    return v === "true" ? true : v === "false" ? false : undefined;
  } catch {
    return undefined;
  }
}

function writeLocal(key: string, on: boolean) {
  try {
    localStorage.setItem(key, String(on));
  } catch {
    // Not remembered this time; the toggle still applies for this visit.
  }
}

/**
 * An on/off setting: saved to the account when it can save, otherwise kept in
 * this browser. Model: docs/backend.md.
 */
function useAccountSetting({ name, storageKey, defaultValue }: SettingSpec): BooleanSetting {
  const { auth, backend } = useBackend();
  const uid = auth.status === "signedIn" ? auth.user.uid : undefined;
  const writer = auth.status === "signedIn" && auth.access === "write";
  const userData = writer ? backend?.userData : undefined;

  const [enabled, setEnabled] = useState(() => resolveSetting(undefined, readLocal(storageKey), defaultValue));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setError(undefined);
    if (auth.status === "loading") {
      setReady(false);
      return;
    }
    const local = readLocal(storageKey);
    if (!userData) {
      setEnabled(resolveSetting(undefined, local, defaultValue));
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    userData.getSetting(name).then(
      (account) => {
        if (cancelled) return;
        setEnabled(resolveSetting(account, local, defaultValue));
        setReady(true);
      },
      (e: unknown) => {
        if (cancelled) return;
        console.error(`Couldn't load the ${name} setting:`, e);
        setEnabled(resolveSetting(undefined, local, defaultValue));
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
    // uid: reload when a different account signs in.
  }, [auth.status, userData, uid, name, storageKey, defaultValue]);

  async function set(on: boolean) {
    setError(undefined);
    if (!userData) {
      writeLocal(storageKey, on);
      setEnabled(on);
      return;
    }
    // Shown only once saved, like playlist edits.
    setSaving(true);
    try {
      await userData.setSetting(name, on);
      setEnabled(on);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return { enabled, ready, saving, error, set };
}

/** The header's settings: Auto-play and Shuffle. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const autoPlay = useAccountSetting(AUTO_PLAY);
  const shuffle = useAccountSetting(SHUFFLE);
  return (
    <AutoPlayContext.Provider value={autoPlay}>
      <ShuffleContext.Provider value={shuffle}>{children}</ShuffleContext.Provider>
    </AutoPlayContext.Provider>
  );
}

/** Whether a game's playlist starts by itself when its page opens. */
export function useAutoPlay(): BooleanSetting {
  return useContext(AutoPlayContext);
}

/** Whether playlists play in a random order. */
export function useShuffle(): BooleanSetting {
  return useContext(ShuffleContext);
}
