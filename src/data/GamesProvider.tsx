import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AddedGame } from "../backend/Backend";
import { useBackend } from "../backend/BackendProvider";
import { findExisting, mergeCatalog, pickSlug, toCatalogGame, type CatalogGame, type GameDetails } from "./addedGames";
import { playlistStore } from "./store";

export interface Games {
  /** Generated games plus the signed-in user's added ones, sorted by name. */
  games: CatalogGame[];
  /**
   * "loading": sign-in or the user's added games are still loading, so a game
   * missing from `games` may yet appear. "loadFailed": only generated games.
   */
  status: "loading" | "ready" | "loadFailed";
  /** Signed in with an account that can save, and the user's games have loaded. */
  canAdd: boolean;
  getGame(slug: string): CatalogGame | undefined;
  /** Saves a new game. If it's already in the catalog, nothing is saved and that game is returned. */
  add(details: GameDetails): Promise<{ game: CatalogGame; existing: boolean }>;
  /** Saves new details for an added game. Throws if they match another game. */
  update(slug: string, details: GameDetails): Promise<void>;
  /** Deletes an added game and its saved playlist. */
  remove(slug: string): Promise<void>;
}

const GamesContext = createContext<Games | undefined>(undefined);

/**
 * The games the app knows about. Generated games are there at once; a signed-in
 * user's added games join once they load. Every change is saved before it shows.
 */
export function GamesProvider({ children }: { children: ReactNode }) {
  const { auth, backend } = useBackend();
  const uid = auth.status === "signedIn" ? auth.user.uid : undefined;
  const userData = uid ? backend?.userData : undefined;

  const [added, setAdded] = useState<AddedGame[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "loadFailed">("ready");

  useEffect(() => {
    setAdded([]);
    if (!userData) {
      setLoadState("ready");
      return;
    }
    let cancelled = false;
    setLoadState("loading");
    userData.listGames().then(
      (games) => {
        if (cancelled) return;
        setAdded(games);
        setLoadState("ready");
      },
      (e: unknown) => {
        if (cancelled) return;
        console.error("Couldn't load added games:", e);
        setLoadState("loadFailed");
      },
    );
    return () => {
      cancelled = true;
    };
    // uid: reload when a different account signs in.
  }, [userData, uid]);

  const status = auth.status === "loading" ? "loading" : loadState;
  const games = useMemo(() => mergeCatalog(playlistStore.listGames(), added), [added]);
  const bySlug = useMemo(() => new Map(games.map((g) => [g.game.slug, g])), [games]);
  const canAdd = auth.status === "signedIn" && auth.access === "write" && !!userData && status === "ready";

  const getGame = useCallback((slug: string) => bySlug.get(slug), [bySlug]);

  const value: Games = {
    games,
    status,
    canAdd,
    getGame,

    async add(details) {
      const existing = findExisting(games, details);
      if (existing) return { game: existing, existing: true };
      const game: AddedGame = { slug: pickSlug(games, details.name, details.year), ...details };
      await userData!.saveGame(game);
      setAdded((list) => [...list, game]);
      return { game: toCatalogGame(game), existing: false };
    },

    async update(slug, details) {
      const other = findExisting(games, details, slug);
      if (other) {
        const year = other.game.year ? ` (${other.game.year})` : "";
        throw new Error(`That's already in the app as ${other.game.name}${year}.`);
      }
      const game: AddedGame = { slug, ...details };
      await userData!.saveGame(game);
      setAdded((list) => list.map((g) => (g.slug === slug ? game : g)));
    },

    async remove(slug) {
      await userData!.deleteGame(slug);
      setAdded((list) => list.filter((g) => g.slug !== slug));
    },
  };

  return <GamesContext.Provider value={value}>{children}</GamesContext.Provider>;
}

export function useGames(): Games {
  const games = useContext(GamesContext);
  if (!games) throw new Error("useGames must be used inside GamesProvider");
  return games;
}
