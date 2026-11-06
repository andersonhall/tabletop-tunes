import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useGames } from "../data/GamesProvider";
import { alternateStore, newAlternate } from "../melodice/alternateStore";
import { parseVideoIds } from "../melodice/melodice";
import { GameForm } from "./GameForm";
import { Layout } from "./Layout";

/** State passed to the game page after "Add" finds the game already there. */
export interface GamePageState {
  note?: string;
}

/**
 * Adds a game that isn't in the app (#/add?name=…&year=…). From the Melodice
 * bookmarklet, `ids` carries its list, which loads as an alternate once added.
 */
export function AddGamePage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const games = useGames();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const ids = useMemo(() => parseVideoIds(`?video_ids=${params.get("ids") ?? ""}`), [params]);

  return (
    <Layout>
      <Link to="/" className="text-sm text-stone-400 hover:text-stone-200">
        ← All games
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Add a game</h1>
      {games.status === "loading" ? (
        <p className="mt-4 text-stone-500">Loading…</p>
      ) : !games.canAdd ? (
        <p className="mt-4 max-w-prose rounded-lg border border-stone-700 bg-stone-900 p-5 text-stone-300">
          {games.status === "loadFailed"
            ? "Couldn't load the games you've added, so adding is off until the page is reloaded."
            : "Adding a game needs a signed-in account that can save."}
        </p>
      ) : (
        <>
          <p className="mt-1 max-w-prose text-sm text-stone-400">
            It's saved to your account. Then add tracks from YouTube links
            {ids.length > 0 ? `, or keep the ${ids.length} Melodice tracks you sent` : " or the Melodice bookmarklet"}.
          </p>
          <div className="mt-6">
            <GameForm
              initial={{ name: params.get("name") ?? "", year: params.get("year") ?? "", bggLink: "" }}
              submitLabel="Add game"
              onSave={async (details) => {
                const { game, existing } = await games.add(details);
                const slug = game.game.slug;
                if (ids.length > 0) alternateStore.set(slug, newAlternate(ids));
                const state: GamePageState | undefined = existing
                  ? { note: `${game.game.name} is already in the app, so here it is.` }
                  : undefined;
                navigate(`/game/${slug}`, { replace: true, state });
              }}
            />
          </div>
        </>
      )}
    </Layout>
  );
}
