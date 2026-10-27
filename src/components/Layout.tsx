import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useBackend } from "../backend/BackendProvider";
import { isFirebaseConfigured } from "../backend/firebaseConfig";
import { useAutoPlay, useShuffle, type BooleanSetting } from "../settings/SettingsProvider";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/" className="text-2xl font-semibold tracking-tight text-amber-400 hover:text-amber-300">
            Tabletop Tunes
          </Link>
          <p className="text-sm text-stone-400">Background music for game night.</p>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-3">
          <SettingToggle
            label="Shuffle"
            title="Play a game's playlist in a random order"
            setting={useShuffle()}
          />
          <SettingToggle
            label="Auto-play"
            title="Start a game's playlist as soon as you open it"
            setting={useAutoPlay()}
          />
          <AccountControls />
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-12 border-t border-stone-800 pt-4 text-xs text-stone-500">
        <Link to="/melodice" className="hover:text-stone-300">
          Melodice bookmarklet
        </Link>
      </footer>
    </div>
  );
}

/** An on/off setting in the header, e.g. Auto-play. */
function SettingToggle({ label, title, setting }: { label: string; title: string; setting: BooleanSetting }) {
  return (
    <div className="text-right text-sm">
      <button
        type="button"
        aria-pressed={setting.enabled}
        title={title}
        disabled={!setting.ready || setting.saving}
        onClick={() => void setting.set(!setting.enabled)}
        className={`rounded-full border px-4 py-1.5 hover:bg-stone-800 disabled:opacity-40 ${
          setting.enabled
            ? "border-amber-500/60 text-amber-400 hover:border-amber-400 hover:text-amber-300"
            : "border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-100"
        }`}
      >
        {label}: {setting.enabled ? "On" : "Off"}
      </button>
      {setting.error && <p className="mt-1 text-red-400">{setting.error}</p>}
    </div>
  );
}

/** Sign in/out, plus why saving is unavailable when it is. Playback never depends on this. */
function AccountControls() {
  const { auth, backend } = useBackend();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Not set up, or failed to load: the site works as before, minus sign-in.
  if (auth.status === "unavailable") {
    return isFirebaseConfigured ? (
      <p className="text-sm text-red-400">{auth.reason} Saving is unavailable.</p>
    ) : null;
  }
  if (auth.status === "loading" || !backend) return null;

  async function run(action: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const button =
    "rounded-full border border-stone-700 px-4 py-1.5 text-sm text-stone-300 hover:border-stone-500 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-40";

  return (
    <div className="text-right text-sm">
      {auth.status === "signedOut" ? (
        <button type="button" className={button} disabled={busy} onClick={() => run(backend.signIn)}>
          Sign in
        </button>
      ) : (
        <div className="flex items-center justify-end gap-3">
          <span className="text-stone-400">{auth.user.name}</span>
          <button type="button" className={button} disabled={busy} onClick={() => run(backend.signOut)}>
            Sign out
          </button>
        </div>
      )}
      {auth.status === "signedIn" && auth.access === "readOnly" && (
        <p className="mt-1 text-stone-500">Editing isn't available for this account.</p>
      )}
      {auth.status === "signedIn" && auth.access === "unreachable" && (
        <p className="mt-1 text-red-400">Can't reach the server. Saving is unavailable.</p>
      )}
      {error && <p className="mt-1 text-red-400">{error}</p>}
    </div>
  );
}

/** Shown when a search or link points at a game with no saved playlist. */
export function NoPlaylist({ name }: { name: string }) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900 p-5">
      <p className="font-medium">
        No playlist for “{name}” yet.
      </p>
      <p className="mt-1 text-sm text-stone-400">
        Playlists are generated ahead of time. Open Claude Code in the tabletop-tunes repo and ask it to
        generate a playlist for this game (see <code className="text-stone-300">docs/generating-playlists.md</code>).
      </p>
    </div>
  );
}
