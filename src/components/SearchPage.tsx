import { Link, useSearchParams } from "react-router-dom";
import { useGames } from "../data/GamesProvider";
import { totalDurationSec } from "../data/schema";
import { searchGames } from "../search";
import { formatDuration } from "../format";
import { Layout, NoPlaylist } from "./Layout";

export function SearchPage() {
  // Keep the query in the URL so "back" from a game returns to the results.
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const { games: all, canAdd, status } = useGames();
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
        {status === "loadFailed" && (
          <p className="mb-3 text-sm text-red-400">Couldn't load the games you added, so only generated games are shown.</p>
        )}
        {query.trim() && results.length === 0 ? (
          canAdd ? (
            <div className="rounded-lg border border-stone-700 bg-stone-900 p-5">
              <p className="font-medium">No game called “{query.trim()}” yet.</p>
              <p className="mt-1 text-sm text-stone-400">Add it, then build its playlist from YouTube links or Melodice.</p>
              <Link
                to={`/add?${new URLSearchParams({ name: query.trim() })}`}
                className="mt-4 inline-block rounded-full bg-amber-500 px-5 py-2 font-semibold text-stone-950 hover:bg-amber-400"
              >
                Add “{query.trim()}”
              </Link>
            </div>
          ) : (
            <NoPlaylist name={query.trim()} />
          )
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
              {results.map(({ game, playlist, added }) => (
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
                      {added
                        ? "added by you"
                        : `${playlist.tracks.length} tracks · ${formatDuration(totalDurationSec(playlist.tracks))}`}
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
