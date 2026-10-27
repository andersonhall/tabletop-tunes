import { useState } from "react";
import { useBackend } from "../backend/BackendProvider";
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
