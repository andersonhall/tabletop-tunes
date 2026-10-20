// Shape of a saved game playlist file (data/games/<slug>.json).
//
// Shared by the web app, the generation tools in tools/, and the tests, so a
// file that validates here is safe for the app to load.

export const SCHEMA_VERSION = 1;

/** Playlists should run roughly 1–2 hours in total. */
export const MIN_PLAYLIST_SEC = 60 * 60;
export const MAX_PLAYLIST_SEC = 2 * 60 * 60;

/** Which music source a track plays from. Only YouTube exists for now. */
export type TrackSource = "youtube";

export interface Track {
  source: TrackSource;
  /** Source-specific id, e.g. a YouTube video id. */
  sourceId: string;
  title: string;
  channel: string;
  durationSec: number;
}

export interface Game {
  bggId: number;
  name: string;
  year: number | null;
  slug: string;
}

export interface Playlist {
  id: string;
  /** Owning user. Single-user for now ("andy"), but every playlist has one. */
  ownerId: string;
  /** Which generator produced it, e.g. "claude-code". */
  generatedBy: string;
  /** ISO date (YYYY-MM-DD). */
  createdAt: string;
  tracks: Track[];
}

export interface GameFile {
  schemaVersion: typeof SCHEMA_VERSION;
  game: Game;
  playlist: Playlist;
}

export type ValidationResult =
  | { ok: true; value: GameFile }
  | { ok: false; errors: string[] };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function totalDurationSec(tracks: readonly Track[]): number {
  return tracks.reduce((sum, t) => sum + t.durationSec, 0);
}

/** Lowercase, hyphenated, ASCII-only slug for a game name. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Structural validation plus the playlist rules (non-empty, unique tracks,
 * 1–2 hours total). Collects every error rather than stopping at the first.
 */
export function validateGameFile(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) return { ok: false, errors: ["file is not a JSON object"] };

  if (input.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  }

  const game = input.game;
  if (!isObject(game)) {
    errors.push("game must be an object");
  } else {
    if (!Number.isInteger(game.bggId) || (game.bggId as number) <= 0) {
      errors.push("game.bggId must be a positive integer");
    }
    if (!isNonEmptyString(game.name)) errors.push("game.name is required");
    if (game.year !== null && !Number.isInteger(game.year)) {
      errors.push("game.year must be an integer or null");
    }
    if (typeof game.slug !== "string" || !SLUG_RE.test(game.slug)) {
      errors.push("game.slug must be a lowercase hyphenated slug");
    }
  }

  const playlist = input.playlist;
  if (!isObject(playlist)) {
    errors.push("playlist must be an object");
  } else {
    if (!isNonEmptyString(playlist.id)) errors.push("playlist.id is required");
    if (!isNonEmptyString(playlist.ownerId)) errors.push("playlist.ownerId is required");
    if (!isNonEmptyString(playlist.generatedBy)) errors.push("playlist.generatedBy is required");
    if (typeof playlist.createdAt !== "string" || !DATE_RE.test(playlist.createdAt)) {
      errors.push("playlist.createdAt must be YYYY-MM-DD");
    }

    if (!Array.isArray(playlist.tracks) || playlist.tracks.length === 0) {
      errors.push("playlist.tracks must be a non-empty array");
    } else {
      const seen = new Set<string>();
      let total = 0;
      playlist.tracks.forEach((t: unknown, i: number) => {
        const at = `playlist.tracks[${i}]`;
        if (!isObject(t)) {
          errors.push(`${at} must be an object`);
          return;
        }
        if (t.source !== "youtube") errors.push(`${at}.source must be "youtube"`);
        if (!isNonEmptyString(t.sourceId)) errors.push(`${at}.sourceId is required`);
        if (!isNonEmptyString(t.title)) errors.push(`${at}.title is required`);
        if (typeof t.channel !== "string") errors.push(`${at}.channel must be a string`);
        if (!Number.isInteger(t.durationSec) || (t.durationSec as number) <= 0) {
          errors.push(`${at}.durationSec must be a positive integer`);
        } else {
          total += t.durationSec as number;
        }
        const key = `${t.source}:${t.sourceId}`;
        if (seen.has(key)) errors.push(`${at} is a duplicate of an earlier track (${key})`);
        seen.add(key);
      });

      if (total < MIN_PLAYLIST_SEC || total > MAX_PLAYLIST_SEC) {
        errors.push(
          `playlist runs ${Math.round(total / 60)} min; it must be between ` +
            `${MIN_PLAYLIST_SEC / 60} and ${MAX_PLAYLIST_SEC / 60} min`,
        );
      }
    }
  }

  return errors.length === 0
    ? { ok: true, value: input as unknown as GameFile }
    : { ok: false, errors };
}
