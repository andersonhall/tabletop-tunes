import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBackend } from "../backend/BackendProvider";
import { bookmarkletHref } from "../melodice/bookmarklet";
import { parseVideoIds } from "../melodice/melodice";
import type { AlternateApi } from "./useAlternate";
import type { GamePlaylist } from "./useGamePlaylist";

const link = "text-stone-400 underline hover:text-stone-200 disabled:opacity-40";
const action = "font-medium text-amber-400 hover:text-amber-300 disabled:opacity-40";

/** Mine | Melodice, plus Close and Replace, while a Melodice alternate is loaded. */
export function AlternateBar(props: {
  alternate: AlternateApi;
  playlist: GamePlaylist;
  select(active: boolean): void;
  close(): void;
}) {
  const { alternate, playlist, select, close } = props;
  const [confirming, setConfirming] = useState(false);
  const why = useCantKeepReason(playlist);

  const segment = (on: boolean) =>
    `px-4 py-1.5 ${on ? "bg-amber-500 font-semibold text-stone-950" : "text-stone-300 hover:bg-stone-800 hover:text-stone-100"}`;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <div role="group" aria-label="Which playlist plays" className="flex overflow-hidden rounded-full border border-stone-700">
        <button type="button" aria-pressed={!alternate.active} className={segment(!alternate.active)} onClick={() => select(false)}>
          Mine
        </button>
        <button type="button" aria-pressed={alternate.active} className={segment(alternate.active)} onClick={() => select(true)}>
          Melodice
        </button>
      </div>
      {alternate.pending > 0 && <span className="text-stone-500">Loading {alternate.pending} Melodice tracks…</span>}
      <button type="button" className={link} onClick={close}>
        Close Melodice list
      </button>
      {why ? (
        <span className="text-stone-500">{why}</span>
      ) : confirming ? (
        <span className="flex flex-wrap items-center gap-x-3">
          <span>Replace your playlist for this game with the Melodice list?</span>
          <button
            type="button"
            className={action}
            disabled={playlist.saving}
            onClick={async () => {
              await playlist.replaceWith(alternate.tracks);
              setConfirming(false);
            }}
          >
            Replace
          </button>
          <button type="button" className={link} disabled={playlist.saving} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          className={link}
          disabled={playlist.saving || alternate.pending > 0 || alternate.tracks.length === 0}
          title={alternate.pending > 0 ? "Waiting for every track to load" : undefined}
          onClick={() => setConfirming(true)}
        >
          Replace mine with this
        </button>
      )}
    </div>
  );
}

/** Why Keep and Replace aren't offered, or undefined if they are. */
function useCantKeepReason(playlist: GamePlaylist): string | undefined {
  const { auth } = useBackend();
  if (playlist.canEdit) return undefined;
  if (auth.status === "signedOut") return "Sign in to keep tracks.";
  if (auth.status === "signedIn" && auth.access === "readOnly") return "Editing isn't available for this account.";
  if (playlist.status === "loading") return undefined;
  return "Saving is unavailable, so tracks can't be kept.";
}

/** Paste a Melodice "Listen on YouTube" link, or drag the bookmarklet that sends one. */
export function MelodiceImportForm({ load }: { load(ids: string[]): void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string>();
  const bookmarklet = useRef<HTMLAnchorElement>(null);

  // Set directly: React won't render a javascript: href.
  useEffect(() => {
    const appUrl = new URL(import.meta.env.BASE_URL, location.origin).href;
    bookmarklet.current?.setAttribute("href", bookmarkletHref(appUrl));
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ids = parseVideoIds(input);
    if (ids.length === 0) {
      setError("That doesn't look like a Melodice “Listen on YouTube” link.");
      return;
    }
    setError(undefined);
    setInput("");
    load(ids);
  }

  return (
    <div className="mt-6 border-t border-stone-800 pt-4 text-sm">
      <p className="text-stone-400">Try this game's Melodice list instead:</p>
      <form onSubmit={onSubmit} className="mt-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste Melodice's “Listen on YouTube” link"
          aria-label="Melodice Listen on YouTube link"
          className="min-w-0 flex-1 rounded-full border border-stone-700 bg-stone-900 px-4 py-1.5 text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-full border border-stone-700 px-4 py-1.5 text-stone-300 hover:border-stone-500 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-40"
        >
          Try it
        </button>
      </form>
      {error && <p className="mt-2 text-red-400">{error}</p>}
      <p className="mt-2 text-stone-500">
        Or drag{" "}
        <a
          ref={bookmarklet}
          onClick={(e) => e.preventDefault()}
          title="Drag to your bookmarks bar, then click it on a Melodice game page"
          className="cursor-grab rounded-full border border-amber-500/60 px-2 py-0.5 text-amber-400 no-underline"
        >
          Send to Tabletop Tunes
        </a>{" "}
        to your bookmarks bar and click it on a Melodice game page.
      </p>
    </div>
  );
}
