import { useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { playlistStore } from "../data/store";
import { totalDurationSec, type GameFile } from "../data/schema";
import { createYouTubeSource, youtubeTrackResolver } from "../music/youtubeSource";
import { usePlayer } from "../player/usePlayer";
import { allUnavailable } from "../player/queue";
import { formatDuration } from "../format";
import { AddTrackForm } from "./AddTrackForm";
import { Layout, NoPlaylist } from "./Layout";
import { TrackList } from "./TrackList";
import { useGamePlaylist, type GamePlaylist } from "./useGamePlaylist";

export function GamePage() {
  const { slug = "" } = useParams();
  const file = playlistStore.getGame(slug);

  return (
    <Layout>
      <Link to="/" className="text-sm text-stone-400 hover:text-stone-200">
        ← All games
      </Link>
      <div className="mt-4">
        {/* key: a fresh player per game, so queue state never leaks between games */}
        {file ? <PlaylistPlayer key={slug} file={file} /> : <NoPlaylist name={slug.replace(/-/g, " ")} />}
      </div>
    </Layout>
  );
}

function PlaylistPlayer({ file }: { file: GameFile }) {
  const { game } = file;
  const playlist = useGamePlaylist(file);
  const { tracks } = playlist;
  const containerRef = useRef<HTMLDivElement>(null);
  const player = usePlayer(tracks, createYouTubeSource, containerRef);
  const current = tracks[player.queue.index];
  const deadEnd = allUnavailable(player.queue);
  // While a signed-in user's copy loads, don't start the generated playlist.
  const loading = playlist.status === "loading";
  const canPlay = player.ready && !loading && tracks.length > 0;

  return (
    <div>
      <h1 className="text-3xl font-semibold">
        {game.name}
        {game.year && <span className="ml-2 text-xl font-normal text-stone-500">({game.year})</span>}
      </h1>
      <p className="mt-1 text-sm text-stone-400">
        {tracks.length} tracks · {formatDuration(totalDurationSec(tracks))} ·{" "}
        {playlist.hasCopy && <>your edited playlist · </>}
        <a
          href={`https://boardgamegeek.com/boardgame/${game.bggId}`}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-stone-200"
        >
          BoardGameGeek
        </a>
      </p>

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
              {player.playing ? "Pause" : player.started ? "Resume" : "Play"}
            </button>
            <ControlButton label="Next track" onClick={player.next} disabled={!canPlay}>
              <SkipIcon direction="forward" />
            </ControlButton>
          </div>
          <div className="mt-3 min-h-[3rem] text-sm">
            {player.error && <p className="text-red-400">{player.error}</p>}
            {!player.ready && !player.error && <p className="text-stone-500">Loading player…</p>}
            {deadEnd ? (
              <p className="text-red-400">None of this playlist's videos can be played right now.</p>
            ) : (
              player.started && current && (
                <p className="text-stone-300">
                  Now playing: <span className="font-medium">{current.title}</span>
                </p>
              )
            )}
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
              {tracks.length > 0 ? (
                <TrackList
                  tracks={tracks}
                  player={player}
                  editing={
                    playlist.canEdit
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
                  This playlist is empty.{playlist.canEdit && " Paste a YouTube link below to add a track."}
                </p>
              )}
              {playlist.canEdit && (
                <>
                  <AddTrackForm playlist={playlist} resolver={youtubeTrackResolver} />
                  <ResetControl playlist={playlist} />
                </>
              )}
            </>
          )}
        </div>
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
