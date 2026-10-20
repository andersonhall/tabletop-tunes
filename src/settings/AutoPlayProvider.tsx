import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useBackend } from "../backend/BackendProvider";
import { resolveAutoPlay } from "../player/autoPlay";

export interface AutoPlaySetting {
  enabled: boolean;
  /** False until the setting is known (e.g. while sign-in or the account's value loads). */
  ready: boolean;
  saving: boolean;
  error?: string;
  set(on: boolean): Promise<void>;
}

const AutoPlayContext = createContext<AutoPlaySetting>({
  enabled: true,
  ready: false,
  saving: false,
  set: async () => {},
});

const STORAGE_KEY = "tabletopTunes.autoPlay";

// localStorage can throw (private windows, blocked site data); the default covers that.
function readLocal(): boolean | undefined {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "true" ? true : v === "false" ? false : undefined;
  } catch {
    return undefined;
  }
}

function writeLocal(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(on));
  } catch {
    // Not remembered this time; the toggle still applies for this visit.
  }
}

/**
 * The Auto-play setting: saved to the account when it can save, otherwise kept
 * in this browser. Model: docs/backend.md.
 */
export function AutoPlayProvider({ children }: { children: ReactNode }) {
  const { auth, backend } = useBackend();
  const uid = auth.status === "signedIn" ? auth.user.uid : undefined;
  const writer = auth.status === "signedIn" && auth.access === "write";
  const userData = writer ? backend?.userData : undefined;

  const [enabled, setEnabled] = useState(() => resolveAutoPlay(undefined, readLocal()));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    setError(undefined);
    if (auth.status === "loading") {
      setReady(false);
      return;
    }
    const local = readLocal();
    if (!userData) {
      setEnabled(resolveAutoPlay(undefined, local));
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    userData.getAutoPlay().then(
      (account) => {
        if (cancelled) return;
        setEnabled(resolveAutoPlay(account, local));
        setReady(true);
      },
      (e: unknown) => {
        if (cancelled) return;
        console.error("Couldn't load the auto-play setting:", e);
        setEnabled(resolveAutoPlay(undefined, local));
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
    // uid: reload when a different account signs in.
  }, [auth.status, userData, uid]);

  async function set(on: boolean) {
    setError(undefined);
    if (!userData) {
      writeLocal(on);
      setEnabled(on);
      return;
    }
    // Shown only once saved, like playlist edits.
    setSaving(true);
    try {
      await userData.setAutoPlay(on);
      setEnabled(on);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AutoPlayContext.Provider value={{ enabled, ready, saving, error, set }}>{children}</AutoPlayContext.Provider>
  );
}

export function useAutoPlay(): AutoPlaySetting {
  return useContext(AutoPlayContext);
}
