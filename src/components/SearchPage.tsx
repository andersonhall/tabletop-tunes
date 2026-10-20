import { Link, useSearchParams } from "react-router-dom";
import { playlistStore } from "../data/store";
import { totalDurationSec } from "../data/schema";
import { searchGames } from "../search";
import { formatDuration } from "../format";
import { Layout, NoPlaylist } from "./Layout";

export function SearchPage() {
  // Keep the query in the URL so "back" from a game returns to the results.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const all = playlistStore.listGames();
  const results = query.trim() ? searchGames(all, query) : all;

  return (
    <Layout>
      <label className="block">
        <span className="sr-only">Search games</span>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          placeholder="Search for a board game…"
          className="w-full rounded-lg border border-stone-700 bg-stone-900 px-4 py-3 text-lg outline-none placeholder:text-stone-500 focus:border-amber-500"
        />
      </label>

      <div className="mt-6">
        {query.trim() && results.length === 0 ? (
          <NoPlaylist name={query.trim()} />
        ) : (
          <>
            {!query.trim() && (
              <p className="mb-3 text-sm text-stone-400">
                {all.length === 0
                  ? "No playlists saved yet."
                  : `${all.length} game${all.length === 1 ? "" : "s"} with playlists`}
              </p>
            )}
            <ul className="divide-y divide-stone-800 overflow-hidden rounded-lg border border-stone-800">
              {results.map(({ game, playlist }) => (
                <li key={game.slug}>
                  <Link
                    to={`/game/${game.slug}`}
                    className="flex items-baseline justify-between px-4 py-3 hover:bg-stone-900"
                  >
                    <span>
                      <span className="font-medium">{game.name}</span>
                      {game.year && <span className="ml-2 text-sm text-stone-500">({game.year})</span>}
                    </span>
                    <span className="text-sm text-stone-500">
                      {playlist.tracks.length} tracks · {formatDuration(totalDurationSec(playlist.tracks))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Layout>
  );
}
