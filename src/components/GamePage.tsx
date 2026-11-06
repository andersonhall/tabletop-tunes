import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { CatalogGame } from "../data/addedGames";
import { useGames } from "../data/GamesProvider";
import { totalDurationSec, type Track } from "../data/schema";
import { alternateStore } from "../melodice/alternateStore";
import { createYouTubeSource, youtubeTrackResolver } from "../music/youtubeSource";
import { usePlayer } from "../player/usePlayer";
import { allUnavailable } from "../player/queue";
import { shouldAutoStart } from "../player/autoPlay";
import { useAutoPlay, useShuffle } from "../settings/SettingsProvider";
import { formatDuration } from "../format";
import type { GamePageState } from "./AddGamePage";
import { AddTrackForm } from "./AddTrackForm";
import { GameForm } from "./GameForm";
import { AlternateBar } from "./AlternateBar";
import { Layout, NoPlaylist } from "./Layout";
import { TrackList } from "./TrackList";
import { useAlternate, type AlternateApi } from "./useAlternate";
import { useGamePlaylist, type GamePlaylist } from "./useGamePlaylist";

export function GamePage() {
  const { slug = "" } = useParams();
  const games = useGames();
  const file = games.getGame(slug);
  const note = (useLocation().state as GamePageState | null)?.note;

  return (
    <Layout>
      <Link to="/" className="text-sm text-stone-400 hover:text-stone-200">
        ← All games
      </Link>
      <div className="mt-4">
        {note && <p className="mb-4 text-sm text-stone-400">{note}</p>}
        {/* key: a fresh player per game, so queue state never leaks between games */}
        {file ? (
          <PlaylistPlayer key={slug} file={file} />
        ) : games.status === "loading" ? (
          <p className="text-stone-500">Loading…</p>
        ) : (
          <NoPlaylist name={slug.replace(/-/g, " ")} />
        )}
      </div>
    </Layout>
  );
}

function PlaylistPlayer({ file }: { file: CatalogGame }) {
  const { game } = file;
  const playlist = useGamePlaylist(file);
  const alternate = useAlternate(game.slug, playlist.hidden, youtubeTrackResolver);
  const melodice = alternate.active;
  // Start the selected list straight away after a switch or a send from
  // Melodice; otherwise the Auto-play setting decides.
  const [startNow, setStartNow] = useState(alternate.fresh);
  const select = (active: boolean) => {
    if (active === melodice) return;
    setStartNow(true);
    alternate.setActive(active);
  };
  const tracks = melodice ? alternate.tracks : playlist.tracks;
  const added = !!file.added;
  const [editing, setEditing] = useState(false);
  const { canAdd } = useGames();

  const details = [
    `${tracks.length} tracks`,
    formatDuration(totalDurationSec(tracks)),
    melodice ? "Melodice list" : added ? "added by you" : playlist.hasCopy ? "your edited playlist" : undefined,
  ].filter(Boolean);

  return (
    <div>
      {editing && added ? (
        <EditGame game={file} done={() => setEditing(false)} />
      ) : (
        <>
          <h1 className="text-3xl font-semibold">
            {game.name}
            {game.year && <span className="ml-2 text-xl font-normal text-stone-500">({game.year})</span>}
          </h1>
          <p className="mt-1 text-sm text-stone-400">
            {details.join(" · ")}
            {game.bggId !== null && (
              <>
                {" · "}
                <a
                  href={`https://boardgamegeek.com/boardgame/${game.bggId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-stone-200"
                >
                  BoardGameGeek
                </a>
              </>
            )}
            {added && canAdd && (
              <>
                {" · "}
                <button type="button" onClick={() => setEditing(true)} className="underline hover:text-stone-200">
                  Edit game
                </button>
              </>
            )}
          </p>
        </>
      )}
      {alternate.exists && (
        <AlternateBar
          alternate={alternate}
          playlist={playlist}
          select={select}
          close={() => {
            if (melodice) setStartNow(true);
            alternate.close();
          }}
        />
      )}
      {/* key: a fresh player per list, so switching never carries queue state over */}
      <PlayerPanel
        key={melodice ? "melodice" : "mine"}
        tracks={tracks}
        playlist={playlist}
        alternate={melodice ? alternate : undefined}
        startNow={startNow}
        generated={!added}
      />
      {added && canAdd && <DeleteGame game={file} />}
    </div>
  );
}

/** Edits an added game's name, year, and BGG link. Its slug stays the same. */
function EditGame({ game, done }: { game: CatalogGame; done: () => void }) {
  const games = useGames();
  const { name, year, bggId } = game.game;
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900 p-5">
      <h1 className="mb-4 text-xl font-semibold">Edit game</h1>
      <GameForm
        initial={{
          name,
          year: year === null ? "" : String(year),
          bggLink: bggId === null ? "" : `https://boardgamegeek.com/boardgame/${bggId}`,
        }}
        submitLabel="Save"
        onSave={async (details) => {
          await games.update(game.game.slug, details);
          done();
        }}
        onCancel={done}
      />
    </div>
  );
}

/** Deletes an added game and its playlist, after an in-page confirm. */
function DeleteGame({ game }: { game: CatalogGame }) {
  const games = useGames();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const link = "text-stone-400 underline hover:text-stone-200 disabled:opacity-40";

  async function remove() {
    setError(undefined);
    setBusy(true);
    try {
      await games.remove(game.game.slug);
      alternateStore.remove(game.game.slug);
      navigate("/", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 border-t border-stone-800 pt-4 text-sm">
      {confirming ? (
        <div className="rounded-lg border border-stone-700 bg-stone-900 p-3">
          <p>Delete {game.game.name} and its playlist? This can't be undone.</p>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              className="font-medium text-red-400 hover:text-red-300 disabled:opacity-40"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
            <button type="button" className={link} disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={link} onClick={() => setConfirming(true)}>
          Delete game
        </button>
      )}
      {error && <p className="mt-2 text-red-400">{error}</p>}
    </div>
  );
}

function PlayerPanel(props: {
  tracks: Track[];
  playlist: GamePlaylist;
  /** Set while the Melodice alternate is the list playing. */
  alternate?: AlternateApi;
  startNow: boolean;
  /** False for a game added on the site: there's no generated playlist to reset to. */
  generated: boolean;
}) {
  const { tracks, playlist, alternate, startNow, generated } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const shuffle = useShuffle();
  const player = usePlayer(tracks, createYouTubeSource, containerRef, shuffle.enabled);
  const current = tracks[player.queue.index];
  const deadEnd = allUnavailable(player.queue);
  // While a signed-in user's copy (and hidden list) loads, don't start anything.
  const loading = playlist.status === "loading";
  const canPlay = player.ready && !loading && tracks.length > 0;

  // Auto-play: once per list, after the user's own copy (if any) has
  // loaded, so the generated playlist never starts first and then switches.
  // Turning the setting on mid-visit starts it too, unless something's already playing.
  const autoPlay = useAutoPlay();
  const autoAttempted = useRef(false);
  const { autoStart } = player;
  useEffect(() => {
    if (
      shouldAutoStart({
        enabled: startNow || autoPlay.enabled,
        // Shuffle too, so a shuffled playlist doesn't start at track 1 first.
        settingReady: autoPlay.ready && shuffle.ready,
        playlistStatus: playlist.status,
        playerReady: player.ready,
        trackCount: tracks.length,
        attempted: autoAttempted.current,
      })
    ) {
      autoAttempted.current = true;
      autoStart();
    }
  }, [startNow, autoPlay.enabled, autoPlay.ready, shuffle.ready, playlist.status, player.ready, tracks.length, autoStart]);
  const blocked = player.blocked && !player.playing;

  // Keeping a Melodice track into the user's own playlist.
  const [keepError, setKeepError] = useState<string>();
  const isKept = (t: Track) => playlist.check(t) === "duplicate";
  async function keep(t: Track) {
    setKeepError(undefined);
    const details = await alternate!.details(t);
    if ("failed" in details) setKeepError(`Couldn't keep that track. ${details.failed}`);
    else await playlist.keep(details);
  }
  const keeping =
    alternate && playlist.canEdit ? { disabled: playlist.saving, isKept, keep: (t: Track) => void keep(t) } : undefined;

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1fr]">
      <div>
        <div
          ref={containerRef}
          className="aspect-video overflow-hidden rounded-lg border border-stone-800 bg-black"
        />
        <div className="mt-4 flex items-center gap-3">
          <ControlButton label="Previous track" onClick={player.prev} disabled={!canPlay}>
            <SkipIcon direction="back" />
          </ControlButton>
          <button
            type="button"
            onClick={player.togglePlay}
            disabled={!canPlay || deadEnd}
            className="h-12 min-w-28 rounded-full bg-amber-500 px-6 font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {player.playing ? "Pause" : player.started && !blocked ? "Resume" : "Play"}
          </button>
          <ControlButton label="Next track" onClick={player.next} disabled={!canPlay}>
            <SkipIcon direction="forward" />
          </ControlButton>
          {keeping && player.started && current && (
            <button
              type="button"
              onClick={() => keeping.keep(current)}
              disabled={keeping.disabled || isKept(current)}
              title="Add the playing track to my playlist for this game"
              className="ml-auto rounded-full border border-amber-500/60 px-4 py-1.5 text-sm text-amber-400 hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
            >
              {isKept(current) ? "Kept" : "Keep"}
            </button>
          )}
        </div>
        <div className="mt-3 min-h-[3rem] text-sm">
          {player.error && <p className="text-red-400">{player.error}</p>}
          {!player.ready && !player.error && <p className="text-stone-500">Loading player…</p>}
          {deadEnd ? (
            <p className="text-red-400">None of this playlist's videos can be played right now.</p>
          ) : (
            player.started && !blocked && current && (
              <p className="text-stone-300">
                Now playing: <span className="font-medium">{current.title}</span>
              </p>
            )
          )}
          {blocked && !deadEnd && <p className="text-stone-300">Click Play to start.</p>}
          {player.skipped && !deadEnd && (
            <p className="text-stone-500">
              Skipped “{player.skipped.title}” ({player.skipped.reason}).
            </p>
          )}
        </div>
      </div>

      <div>
        {loading ? (
          <p className="rounded-lg border border-stone-800 px-3 py-2 text-sm text-stone-500">Loading your playlist…</p>
        ) : (
          <>
            {playlist.status === "loadFailed" && (
              <p className="mb-2 text-sm text-red-400">
                Couldn't load your saved changes, so this is the generated playlist. Editing is off until the page
                is reloaded.
              </p>
            )}
            <EditStatus playlist={playlist} />
            {keepError && <p className="mb-2 text-sm text-red-400">{keepError}</p>}
            {tracks.length > 0 ? (
              <TrackList
                tracks={tracks}
                player={player}
                keeping={keeping}
                editing={
                  !alternate && playlist.canEdit
                    ? {
                        disabled: playlist.saving,
                        move: (from, to) => void playlist.move(from, to),
                        remove: (t) => void playlist.remove(t),
                        hide: (t) => void playlist.hide(t),
                      }
                    : undefined
                }
              />
            ) : (
              <p className="rounded-lg border border-stone-800 px-3 py-2 text-sm text-stone-500">
                {alternate
                  ? "None of the Melodice tracks can be played here."
                  : `This playlist is empty.${
                      playlist.canEdit
                        ? " Paste a YouTube link below to add a track, or send this game's Melodice list with the bookmarklet."
                        : ""
                    }`}
              </p>
            )}
            {!alternate && playlist.canEdit && (
              <>
                <AddTrackForm playlist={playlist} resolver={youtubeTrackResolver} />
                {generated && <ResetControl playlist={playlist} />}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Saving…, the last save's error, and the Undo offer after a remove or hide. */
function EditStatus({ playlist }: { playlist: GamePlaylist }) {
  if (!playlist.saving && !playlist.error && !playlist.undoMessage) return null;
  return (
    <div className="mb-2 flex min-h-7 flex-wrap items-center gap-x-3 text-sm" role="status">
      {playlist.error && <span className="text-red-400">{playlist.error}</span>}
      {!playlist.error && playlist.undoMessage && <span className="text-stone-300">{playlist.undoMessage}</span>}
      {playlist.undoMessage && (
        <button
          type="button"
          onClick={() => void playlist.undo()}
          disabled={playlist.saving}
          className="font-medium text-amber-400 hover:text-amber-300 disabled:opacity-40"
        >
          Undo
        </button>
      )}
      {playlist.saving && <span className="text-stone-500">Saving…</span>}
    </div>
  );
}

function ResetControl({ playlist }: { playlist: GamePlaylist }) {
  const [confirming, setConfirming] = useState(false);
  if (!playlist.hasCopy) return null;
  const link = "text-stone-400 underline hover:text-stone-200 disabled:opacity-40";
  return (
    <div className="mt-4 text-sm">
      {confirming ? (
        <div className="rounded-lg border border-stone-700 bg-stone-900 p-3">
          <p>
            Replace your edited playlist with the current generated one? Your changes to this game will be lost.
            Tracks you've hidden stay hidden.
          </p>
          <div className="mt-2 flex gap-4">
            <button
              type="button"
              className="font-medium text-amber-400 hover:text-amber-300 disabled:opacity-40"
              disabled={playlist.saving}
              onClick={async () => {
                await playlist.reset();
                setConfirming(false);
              }}
            >
              Reset
            </button>
            <button type="button" className={link} disabled={playlist.saving} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={link} disabled={playlist.saving} onClick={() => setConfirming(true)}>
          Reset to generated playlist
        </button>
      )}
    </div>
  );
}

function ControlButton(props: { label: string; onClick: () => void; disabled: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-700 text-stone-300 hover:border-stone-500 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}

/** Skip-track glyph (bar + triangle); drawn as SVG so it doesn't render as a color emoji. */
function SkipIcon({ direction }: { direction: "back" | "forward" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-5 w-5 fill-current ${direction === "back" ? "-scale-x-100" : ""}`}
    >
      <path d="M6 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 6 5.5Z" />
      <rect x="17" y="5" width="2.5" height="14" rx="1" />
    </svg>
  );
}
