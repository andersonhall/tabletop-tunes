import type { GameFile } from "./data/schema";

/** Lowercases and strips accents/punctuation so "Agricola" ≈ "agrícola!". */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Games whose name contains every word of the query (in any order).
 * Names that start with the query rank first, then alphabetical.
 */
export function searchGames(games: readonly GameFile[], query: string): GameFile[] {
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(" ");

  return games
    .map((g) => ({ g, name: normalize(g.game.name) }))
    .filter(({ name }) => words.every((w) => name.includes(w)))
    .sort((a, b) => {
      const aPrefix = a.name.startsWith(q) ? 0 : 1;
      const bPrefix = b.name.startsWith(q) ? 0 : 1;
      return aPrefix - bPrefix || a.g.game.name.localeCompare(b.g.game.name);
    })
    .map(({ g }) => g);
}
