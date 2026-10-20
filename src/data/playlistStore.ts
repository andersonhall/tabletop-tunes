import { validateGameFile, type GameFile } from "./schema";

/**
 * Where the app reads saved playlists from. The MVP reads JSON files bundled
 * from data/games/; a database-backed store can implement this later.
 */
export interface PlaylistStore {
  listGames(): GameFile[];
  getGame(slug: string): GameFile | undefined;
}

/** Builds a store from already-parsed files, skipping (and logging) invalid ones. */
export function createStaticPlaylistStore(files: Record<string, unknown>): PlaylistStore {
  const games: GameFile[] = [];
  for (const [path, raw] of Object.entries(files)) {
    const result = validateGameFile(raw);
    if (result.ok) {
      games.push(result.value);
    } else {
      console.error(`Skipping invalid playlist file ${path}:`, result.errors);
    }
  }
  games.sort((a, b) => a.game.name.localeCompare(b.game.name));
  const bySlug = new Map(games.map((g) => [g.game.slug, g]));

  return {
    listGames: () => games,
    getGame: (slug) => bySlug.get(slug),
  };
}
