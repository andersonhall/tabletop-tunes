import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthState, Backend } from "./Backend";
import { isFirebaseConfigured } from "./firebaseConfig";

interface BackendContextValue {
  auth: AuthState;
  /** Undefined until loaded, or when the backend is unavailable. */
  backend?: Backend;
}

const BackendContext = createContext<BackendContextValue>({ auth: { status: "loading" } });

declare global {
  interface Window {
    /** Devtools hook for checking saved data by hand (docs/backend.md). Rules still apply. */
    tabletopTunes?: { userData: Backend["userData"] };
  }
}

/**
 * Loads the backend in its own chunk, so search and playback of generated
 * playlists never wait on it, or break if it can't load.
 */
export function BackendProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<BackendContextValue>(() =>
    isFirebaseConfigured
      ? { auth: { status: "loading" } }
      : { auth: { status: "unavailable", reason: "Sign-in isn't set up yet." } },
  );

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    import("./firebaseBackend")
      .then(({ createFirebaseBackend }) => {
        if (cancelled) return;
        const backend = createFirebaseBackend();
        window.tabletopTunes = { userData: backend.userData };
        unsubscribe = backend.onAuthChange((auth) => setValue({ auth, backend }));
      })
      .catch((e: unknown) => {
        console.error("Backend failed to load:", e);
        if (!cancelled) setValue({ auth: { status: "unavailable", reason: "Sign-in couldn't load." } });
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend(): BackendContextValue {
  return useContext(BackendContext);
}
