// Pure logic for games added on the website (#17). They live in the user's
// data (users/{uid}/games/{slug}), not in data/games/, and are merged with the
// generated games into one catalog. Data model: docs/backend.md.

import type { AddedGame } from "../backend/Backend";
import { normalize } from "../search";
import { SCHEMA_VERSION, slugify, type GameFile } from "./schema";

/** `playlist.generatedBy` for a game added on the website. */
export const ADDED_BY = "website";

/** One game the app knows about: a generated file, or one the user added. */
export type CatalogGame = GameFile & {
  /** Set when the user added this game on the website. */
  added?: AddedGame;
  /**
   * Where the user's saved copy of this game's playlist lives, if not under
   * its own slug: a game added on the site that a generated file later replaced.
   */
  copySlug?: string;
};

/** The BGG id in a BoardGameGeek game link, or undefined if it isn't one. */
export function parseBggLink(text: string): number | undefined {
  const m = /^(?:https?:\/\/)?(?:www\.)?boardgamegeek\.com\/boardgame(?:expansion)?\/(\d+)(?:[/?#].*)?$/i.exec(
    text.trim(),
  );
  if (!m) return undefined;
  const id = Number(m[1]);
  return id > 0 ? id : undefined;
}

export interface GameForm {
  name: string;
  year: string;
  bggLink: string;
}

export type GameDetails = Pick<AddedGame, "name" | "year" | "bggId">;

export const MIN_YEAR = 1800;

/** Checks the add/edit form. Returns the cleaned details, or what's wrong. */
export function validateGameForm(
  form: GameForm,
  thisYear = new Date().getFullYear(),
): { ok: true; value: GameDetails } | { ok: false; error: string } {
  const name = form.name.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Enter the game's name." };
  if (!slugify(name)) return { ok: false, error: "The name needs at least one letter or number." };

  let year: number | null = null;
  const yearText = form.year.trim();
  if (yearText) {
    year = /^\d{4}$/.test(yearText) ? Number(yearText) : NaN;
    if (!(year >= MIN_YEAR && year <= thisYear + 1)) {
      return { ok: false, error: `The year should be a 4-digit year from ${MIN_YEAR} to ${thisYear + 1}.` };
    }
  }

  let bggId: number | null = null;
  if (form.bggLink.trim()) {
    const id = parseBggLink(form.bggLink);
    if (id === undefined) {
      return { ok: false, error: "That isn't a BoardGameGeek game link (boardgamegeek.com/boardgame/…)." };
    }
    bggId = id;
  }

  return { ok: true, value: { name, year, bggId } };
}

/** Whether two games are the same: same BGG id, or same name and year. */
export function sameGame(a: GameDetails, b: GameDetails): boolean {
  if (a.bggId !== null && b.bggId !== null) return a.bggId === b.bggId;
  return normalize(a.name) === normalize(b.name) && a.year === b.year;
}

/** The game in the catalog that these details describe, if any (ignoring `exceptSlug`). */
export function findExisting(
  catalog: readonly CatalogGame[],
  details: GameDetails,
  exceptSlug?: string,
): CatalogGame | undefined {
  return catalog.find((g) => g.game.slug !== exceptSlug && sameGame(g.game, details));
}

/** A slug for a new game that no catalog game uses: the name, then name-year, then -2, -3… */
export function pickSlug(catalog: readonly CatalogGame[], name: string, year: number | null): string {
  const taken = new Set(catalog.map((g) => g.game.slug));
  const base = slugify(name);
  if (!taken.has(base)) return base;
  const withYear = year !== null ? `${base}-${year}` : base;
  if (!taken.has(withYear)) return withYear;
  for (let n = 2; ; n++) {
    if (!taken.has(`${withYear}-${n}`)) return `${withYear}-${n}`;
  }
}

/** An added game as a catalog entry. Its playlist is empty; the user's saved copy has the tracks. */
export function toCatalogGame(added: AddedGame): CatalogGame {
  return {
    schemaVersion: SCHEMA_VERSION,
    game: { slug: added.slug, name: added.name, year: added.year, bggId: added.bggId },
    playlist: { id: `${added.slug}-${ADDED_BY}`, ownerId: "", generatedBy: ADDED_BY, createdAt: "", tracks: [] },
    added,
  };
}

/**
 * Generated games plus the user's added ones, sorted by name. An added game
 * that a generated file now covers is left out, and the generated entry points
 * at the added game's saved copy so the user's tracks are kept.
 */
export function mergeCatalog(generated: readonly GameFile[], added: readonly AddedGame[]): CatalogGame[] {
  const out: CatalogGame[] = [...generated];
  for (const a of added) {
    const i = out.findIndex((g) => !g.added && sameGame(g.game, a));
    if (i === -1) {
      out.push(toCatalogGame(a));
    } else if (out[i]!.game.slug !== a.slug && !out[i]!.copySlug) {
      out[i] = { ...out[i]!, copySlug: a.slug };
    }
  }
  return out.sort((a, b) => a.game.name.localeCompare(b.game.name));
}
