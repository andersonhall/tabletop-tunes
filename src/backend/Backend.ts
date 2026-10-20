// The backend layer: sign-in plus per-user saved data. Firebase is the only
// implementation today; the UI talks to this interface so it can be swapped
// later without touching components. Generated playlists don't live here.
// They stay static files in data/games/ (see src/data/playlistStore.ts).

import type { Track } from "../data/schema";

export interface User {
  uid: string;
  name: string;
}

export type AuthState =
  | { status: "loading" }
  /** Backend not configured or failed to load; the app works without it. */
  | { status: "unavailable"; reason: string }
  | { status: "signedOut" }
  | {
      status: "signedIn";
      user: User;
      /**
       * Whether this account may save data. "unreachable" means we couldn't ask
       * the server, so saving is unavailable for now.
       */
      access: "write" | "readOnly" | "unreachable";
    };

/** A user's own copy of a game's playlist, made the first time they edit it. */
export interface SavedPlaylist {
  gameSlug: string;
  /** Which generated playlist this copy started from, e.g. "cascadia-default@2026-10-20". */
  basedOn: string;
  tracks: Track[];
}

/** Per-user saved data. Every call goes to the server, or throws. Nothing is queued offline. */
export interface UserDataStore {
  getPlaylist(slug: string): Promise<SavedPlaylist | undefined>;
  savePlaylist(playlist: SavedPlaylist): Promise<void>;
  deletePlaylist(slug: string): Promise<void>;
  /** Tracks hidden from all of the user's playlists, as `trackKey()` strings. */
  getHiddenTracks(): Promise<string[]>;
  setHiddenTracks(keys: readonly string[]): Promise<void>;
  /** Undefined if the user has never changed it. */
  getAutoPlay(): Promise<boolean | undefined>;
  setAutoPlay(on: boolean): Promise<void>;
}

export interface Backend {
  /** Calls `cb` now with the current state and on every change. Returns an unsubscribe. */
  onAuthChange(cb: (state: AuthState) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Acts as the signed-in user; throws NotSignedInError when signed out. */
  userData: UserDataStore;
}

/** "youtube:<id>": identifies a track across all games. */
export function trackKey(t: Pick<Track, "source" | "sourceId">): string {
  return `${t.source}:${t.sourceId}`;
}

/** The server couldn't be reached (or didn't answer in time). Nothing was saved. */
export class BackendUnavailableError extends Error {
  constructor(message = "Can't reach the server, so changes can't be saved right now.") {
    super(message);
    this.name = "BackendUnavailableError";
  }
}

/** The server refused: this account isn't allowed to save. */
export class NotAllowedError extends Error {
  constructor(message = "Editing isn't available for this account.") {
    super(message);
    this.name = "NotAllowedError";
  }
}

export class NotSignedInError extends Error {
  constructor(message = "Sign in to save changes.") {
    super(message);
    this.name = "NotSignedInError";
  }
}
