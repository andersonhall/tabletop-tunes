// Melodice alternates: pure logic for turning a Melodice game page's list into
// something the app can play. melodice.org sends no CORS headers, so the ids
// arrive from Melodice's side (the bookmarklet, or a pasted link), never by
// fetching. See docs/melodice.md.

import type { GameFile } from "../data/schema";
import { normalize, searchGames } from "../search";

/** Melodice's "Listen on YouTube" link carries at most this many. */
export const MAX_IDS = 50;

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * The video ids in a "Listen on YouTube" link: a youtube.com/watch_videos
 * link, or Melodice's own /redirect/… wrapper around one (what "Copy link
 * address" gives you, with the query URL-encoded). In order, de-duped, capped.
 */
export function parseVideoIds(input: string): string[] {
  let text = input.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // Not encoded, or malformed: use as is.
  }
  const m = /[?&]video_ids=([^&#\s]+)/.exec(text);
  if (!m) return [];
  const ids = m[1]!.split(",").filter((id) => VIDEO_ID_RE.test(id));
  return [...new Set(ids)].slice(0, MAX_IDS);
}

/** What the bookmarklet sends: the Melodice page's game and its list. */
export interface MelodiceImport {
  name: string;
  /** Melodice's page slug, e.g. "agricola-2007". */
  melodiceSlug: string;
  ids: string[];
}

/** The year at the end of a Melodice slug ("agricola-2007" → 2007). */
export function slugYear(melodiceSlug: string): number | undefined {
  const m = /-(\d{4})$/.exec(melodiceSlug);
  return m ? Number(m[1]) : undefined;
}

/** Query string for the app's `#/import` route. */
export function importQuery(i: MelodiceImport): string {
  return new URLSearchParams({ name: i.name, slug: i.melodiceSlug, ids: i.ids.join(",") }).toString();
}

export function parseImportQuery(search: string): MelodiceImport {
  const p = new URLSearchParams(search);
  return {
    name: p.get("name")?.trim() ?? "",
    melodiceSlug: p.get("slug")?.trim() ?? "",
    ids: parseVideoIds(`?video_ids=${p.get("ids") ?? ""}`),
  };
}

export type GameMatch = { kind: "match"; game: GameFile } | { kind: "choose"; candidates: GameFile[] };

/**
 * The app game a Melodice page is for: exactly one game with the same name and
 * year, or whose slug + year is Melodice's slug. Anything less certain is left
 * to the user to choose, with name-search candidates.
 */
export function matchGame(games: readonly GameFile[], i: Pick<MelodiceImport, "name" | "melodiceSlug">): GameMatch {
  const year = slugYear(i.melodiceSlug);
  const name = normalize(i.name);
  const exact = games.filter(
    ({ game }) =>
      (game.year !== null && `${game.slug}-${game.year}` === i.melodiceSlug) ||
      (!!name && normalize(game.name) === name && game.year === (year ?? null)),
  );
  if (exact.length === 1) return { kind: "match", game: exact[0]! };
  return { kind: "choose", candidates: exact.length > 1 ? exact : searchGames(games, i.name) };
}
