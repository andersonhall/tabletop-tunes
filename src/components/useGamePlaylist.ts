import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackKey, type SavedPlaylist } from "../backend/Backend";
import { useBackend } from "../backend/BackendProvider";
import { appendTrack, basedOnId, checkAdd, moveTrack, removeTrack, visibleTracks } from "../data/curation";
import type { GameFile, Track } from "../data/schema";
import type { TrackRef } from "../music/MusicSource";

/** How long the Undo offer stays up after a remove or hide. */
const UNDO_MS = 8_000;

interface UndoOffer {
  message: string;
  run(): Promise<void>;
}

export interface GamePlaylist {
  /**
   * "loading": fetching the signed-in user's copy and hidden tracks.
   * "loadFailed": couldn't, so this is the generated playlist and editing is
   * off for this visit (saving from it could overwrite their copy).
   */
  status: "loading" | "ready" | "loadFailed";
  tracks: Track[];
  /** Tracks hidden from all of the user's playlists, as `trackKey()` strings. */
  hidden: ReadonlySet<string>;
  canEdit: boolean;
  /** The user has their own copy of this game's playlist. */
  hasCopy: boolean;
  saving: boolean;
  error?: string;
  /** What the last remove or hide did, while it can still be undone. */
  undoMessage?: string;
  undo(): Promise<void>;
  check(ref: TrackRef): ReturnType<typeof checkAdd>;
  remove(track: Track): Promise<void>;
  hide(track: Track): Promise<void>;
  move(from: number, to: number): Promise<void>;
  /** Adds to the end; `unhide` also takes it off the hidden list. Resolves true once saved. */
  add(track: Track, unhide?: boolean): Promise<boolean>;
  /** Adds a track from a Melodice alternate to the end, with Undo. Already there: no-op. */
  keep(track: Track): Promise<void>;
  /** Makes the user's copy exactly these tracks, with Undo. */
  replaceWith(tracks: readonly Track[]): Promise<void>;
  reset(): Promise<void>;
}

interface UserData {
  saved?: SavedPlaylist;
  hidden: string[];
}

const EMPTY: UserData = { hidden: [] };

/**
 * The playlist a game page shows, plus the user's edits to it. Every edit is
 * saved before it's shown; if the save fails, nothing changes and `error` says
 * why. Model: docs/backend.md.
 */
export function useGamePlaylist(file: GameFile): GamePlaylist {
  const { auth, backend } = useBackend();
  const slug = file.game.slug;
  const uid = auth.status === "signedIn" ? auth.user.uid : undefined;
  const writer = auth.status === "signedIn" && auth.access === "write";
  const userData = uid ? backend?.userData : undefined;

  const [data, setData] = useState<UserData>(EMPTY);
  const [status, setStatus] = useState<GamePlaylist["status"]>(uid ? "loading" : "ready");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [undo, setUndoState] = useState<UndoOffer>();
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setError(undefined);
    setUndoState(undefined);
    if (!userData) {
      setData(EMPTY);
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    Promise.all([userData.getPlaylist(slug), userData.getHiddenTracks()]).then(
      ([saved, hidden]) => {
        if (cancelled) return;
        setData({ saved, hidden });
        setStatus("ready");
      },
      (e: unknown) => {
        if (cancelled) return;
        console.error("Couldn't load saved playlist:", e);
        setData(EMPTY);
        setStatus("loadFailed");
      },
    );
    return () => {
      cancelled = true;
    };
    // uid: reload when a different account signs in.
  }, [userData, slug, uid]);

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const hiddenSet = useMemo(() => new Set(data.hidden), [data.hidden]);
  const tracks = useMemo(
    () => visibleTracks(file.playlist, data.saved, hiddenSet),
    [file.playlist, data.saved, hiddenSet],
  );
  const canEdit = writer && !!userData && status === "ready";

  const setUndo = useCallback((offer?: UndoOffer) => {
    clearTimeout(undoTimer.current);
    setUndoState(offer);
    if (offer) undoTimer.current = setTimeout(() => setUndoState(undefined), UNDO_MS);
  }, []);

  /** Runs one save; shows nothing new unless it succeeds. */
  async function save(op: () => Promise<void>): Promise<boolean> {
    if (!userData) return false;
    setError(undefined);
    setSaving(true);
    try {
      await op();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function copyWith(next: Track[]): SavedPlaylist {
    return { gameSlug: slug, basedOn: data.saved?.basedOn ?? basedOnId(file.playlist), tracks: next };
  }

  async function saveTracks(next: Track[]) {
    const copy = copyWith(next);
    await userData!.savePlaylist(copy);
    setData((d) => ({ ...d, saved: copy }));
  }

  async function restoreCopy(prev: SavedPlaylist | undefined) {
    if (prev) await userData!.savePlaylist(prev);
    else await userData!.deletePlaylist(slug);
    setData((d) => ({ ...d, saved: prev }));
  }

  async function saveHidden(next: string[]) {
    await userData!.setHiddenTracks(next);
    setData((d) => ({ ...d, hidden: next }));
  }

  return {
    status,
    tracks,
    hidden: hiddenSet,
    canEdit,
    hasCopy: !!data.saved,
    saving,
    error,
    undoMessage: undo?.message,
    check: (ref) => checkAdd(tracks, hiddenSet, ref),

    async remove(track) {
      setUndo(undefined);
      const prev = data.saved;
      const ok = await save(() => saveTracks(removeTrack(tracks, trackKey(track))));
      if (ok) {
        setUndo({ message: `Removed “${track.title}”.`, run: () => restoreCopy(prev) });
      }
    },

    async hide(track) {
      setUndo(undefined);
      const prev = data.hidden;
      const ok = await save(() => saveHidden([...prev, trackKey(track)]));
      if (ok) {
        setUndo({ message: `Hidden from all your playlists: “${track.title}”.`, run: () => saveHidden(prev) });
      }
    },

    async move(from, to) {
      setUndo(undefined);
      await save(() => saveTracks(moveTrack(tracks, from, to)));
    },

    async add(track, unhide = false) {
      setUndo(undefined);
      const key = trackKey(track);
      return save(async () => {
        await saveTracks(appendTrack(tracks, track));
        if (unhide) await saveHidden(data.hidden.filter((k) => k !== key));
      });
    },

    async keep(track) {
      if (checkAdd(tracks, hiddenSet, track) === "duplicate") return;
      setUndo(undefined);
      const prev = data.saved;
      const ok = await save(() => saveTracks(appendTrack(tracks, track)));
      if (ok) setUndo({ message: `Kept “${track.title}”.`, run: () => restoreCopy(prev) });
    },

    async replaceWith(next) {
      setUndo(undefined);
      const prev = data.saved;
      const ok = await save(() => saveTracks([...next]));
      if (ok) setUndo({ message: "Replaced your playlist with the Melodice list.", run: () => restoreCopy(prev) });
    },

    async undo() {
      // Keep the offer if the save fails, so it can be retried.
      if (undo && (await save(undo.run))) setUndo(undefined);
    },

    async reset() {
      setUndo(undefined);
      await save(() => restoreCopy(undefined));
    },
  };
}
