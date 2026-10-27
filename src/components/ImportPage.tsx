import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { playlistStore } from "../data/store";
import type { GameFile } from "../data/schema";
import { alternateStore, newAlternate } from "../melodice/alternateStore";
import { matchGame, parseImportQuery } from "../melodice/melodice";
import { searchGames } from "../search";
import { Layout } from "./Layout";

/**
 * Where the "Send to Tabletop Tunes" bookmarklet lands (#/import?name=…&slug=…&ids=…).
 * A clear match goes straight to that game with the Melodice list playing;
 * otherwise the user picks the game.
 */
export function ImportPage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const sent = useMemo(() => parseImportQuery(search), [search]);
  const match = useMemo(() => matchGame(playlistStore.listGames(), sent), [sent]);
  const [query, setQuery] = useState(sent.name);

  function attach(game: GameFile) {
    alternateStore.set(game.game.slug, newAlternate(sent.ids));
    navigate(`/game/${game.game.slug}`, { replace: true });
  }

  useEffect(() => {
    if (sent.ids.length > 0 && match.kind === "match") attach(match.game);
  }, [sent, match]);

  // Until the user searches, the candidates matchGame found.
  const searched = query.trim() !== sent.name;
  const results = !searched && match.kind === "choose" ? match.candidates : searchGames(playlistStore.listGames(), query);

  return (
    <Layout>
      <Link to="/" className="text-sm text-stone-400 hover:text-stone-200">
        ← All games
      </Link>
      <div className="mt-4">
        {sent.ids.length === 0 ? (
          <p className="rounded-lg border border-stone-700 bg-stone-900 p-5 text-red-400">
            That Melodice link didn't have any YouTube videos in it.
          </p>
        ) : match.kind === "match" ? (
          <p className="text-stone-500">Opening {match.game.game.name}…</p>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold">Which game is this Melodice list for?</h1>
            <p className="mt-1 text-sm text-stone-400">
              Melodice sent “{sent.name || sent.melodiceSlug}” ({sent.ids.length} tracks)
              {results.length === 0 && !searched && ", which doesn't match a game in the app yet"}.
            </p>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search games"
              placeholder="Search games"
              className="mt-4 w-full rounded-full border border-stone-700 bg-stone-900 px-4 py-2 text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
            <ul className="mt-3 divide-y divide-stone-800 rounded-lg border border-stone-800">
              {results.map((g) => (
                <li key={g.game.slug}>
                  <button
                    type="button"
                    onClick={() => attach(g)}
                    className="w-full px-4 py-2 text-left hover:bg-stone-900"
                  >
                    {g.game.name}
                    {g.game.year && <span className="ml-2 text-stone-500">({g.game.year})</span>}
                  </button>
                </li>
              ))}
              {results.length === 0 && <li className="px-4 py-2 text-sm text-stone-500">No games match.</li>}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
