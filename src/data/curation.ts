// Pure logic for a user's curation of a game's playlist. The generated
// playlist is a cookie cutter: until the user edits a game, they see it minus
// their hidden tracks; after that, they see their own saved copy (also minus
// hidden tracks). Data model: docs/backend.md.

import { trackKey, type SavedPlaylist } from "../backend/Backend";
import type { Playlist, Track } from "./schema";

/** What the user sees and hears for a game. */
export function visibleTracks(
  generated: Playlist,
  saved: SavedPlaylist | undefined,
  hidden: ReadonlySet<string>,
): Track[] {
  return (saved?.tracks ?? generated.tracks).filter((t) => !hidden.has(trackKey(t)));
}

/** Records which generated playlist a copy started from, e.g. "cascadia-default@2026-10-20". */
export function basedOnId(p: Pick<Playlist, "id" | "createdAt">): string {
  return `${p.id}@${p.createdAt}`;
}

export function removeTrack(tracks: readonly Track[], key: string): Track[] {
  return tracks.filter((t) => trackKey(t) !== key);
}

/** Moves the track at `from` to position `to`; out-of-range moves are no-ops. */
export function moveTrack(tracks: readonly Track[], from: number, to: number): Track[] {
  const out = [...tracks];
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [t] = out.splice(from, 1);
  out.splice(to, 0, t!);
  return out;
}

export function appendTrack(tracks: readonly Track[], track: Track): Track[] {
  return [...tracks, track];
}

/** Whether a pasted track can go straight in, is already there, or was hidden everywhere. */
export function checkAdd(
  visible: readonly Track[],
  hidden: ReadonlySet<string>,
  track: Pick<Track, "source" | "sourceId">,
): "ok" | "duplicate" | "hidden" {
  const key = trackKey(track);
  if (hidden.has(key)) return "hidden";
  if (visible.some((t) => trackKey(t) === key)) return "duplicate";
  return "ok";
}
