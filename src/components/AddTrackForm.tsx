import { useState, type FormEvent } from "react";
import type { Track } from "../data/schema";
import type { TrackResolver } from "../music/MusicSource";
import type { GamePlaylist } from "./useGamePlaylist";

type Note = { kind: "info" | "error"; text: string };

/** Paste a link, test that it plays, then add it to the end of the playlist. */
export function AddTrackForm({ playlist, resolver }: { playlist: GamePlaylist; resolver: TrackResolver }) {
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<Note>();
  // A hidden track waiting for "Un-hide and add" or "Cancel".
  const [confirmUnhide, setConfirmUnhide] = useState<Track>();
  const busy = checking || playlist.saving;

  async function add(track: Track, unhide = false) {
    setConfirmUnhide(undefined);
    if (await playlist.add(track, unhide)) {
      setInput("");
      setNote({ kind: "info", text: `Added “${track.title}”.` });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNote(undefined);
    setConfirmUnhide(undefined);
    const ref = resolver.identify(input);
    if (!ref) {
      setNote({ kind: "error", text: "That doesn't look like a YouTube link or video id." });
      return;
    }
    // Checked before testing the video, so a duplicate is caught straight away.
    if (playlist.check(ref) === "duplicate") {
      setNote({ kind: "error", text: "That video is already in this playlist." });
      return;
    }
    setChecking(true);
    const result = await resolver.resolve(ref).finally(() => setChecking(false));
    if (!result.ok) {
      setNote({ kind: "error", text: `Couldn't add that video. ${result.reason}` });
      return;
    }
    if (playlist.check(ref) === "hidden") setConfirmUnhide(result.track);
    else await add(result.track);
  }

  const button =
    "rounded-full border border-stone-700 px-4 py-1.5 text-sm text-stone-300 hover:border-stone-500 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-40";

  return (
    <div className="mt-3 text-sm">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a YouTube link or video id"
          aria-label="YouTube link or video id"
          disabled={busy}
          className="min-w-0 flex-1 rounded-full border border-stone-700 bg-stone-900 px-4 py-1.5 text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none disabled:opacity-60"
        />
        <button type="submit" className={button} disabled={busy || !input.trim()}>
          {checking ? "Checking…" : "Add"}
        </button>
      </form>
      {checking && <p className="mt-2 text-stone-500">Checking that the video plays…</p>}
      {confirmUnhide && (
        <div className="mt-2 rounded-lg border border-stone-700 bg-stone-900 p-3">
          <p>
            You hid “{confirmUnhide.title}” from all your playlists. Un-hide it and add it here?
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={button} disabled={busy} onClick={() => add(confirmUnhide, true)}>
              Un-hide and add
            </button>
            <button type="button" className={button} disabled={busy} onClick={() => setConfirmUnhide(undefined)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {note && <p className={`mt-2 ${note.kind === "error" ? "text-red-400" : "text-stone-400"}`}>{note.text}</p>}
    </div>
  );
}
