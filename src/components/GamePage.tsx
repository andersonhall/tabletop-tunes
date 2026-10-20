import { useRef, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { playlistStore } from "../data/store";
import { totalDurationSec, type GameFile } from "../data/schema";
import { createYouTubeSource } from "../music/youtubeSource";
import { usePlayer } from "../player/usePlayer";
import { allUnavailable } from "../player/queue";
import { formatDuration } from "../format";
import { Layout, NoPlaylist } from "./Layout";

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
  const { game, playlist } = file;
  const containerRef = useRef<HTMLDivElement>(null);
  const player = usePlayer(playlist.tracks, createYouTubeSource, containerRef);
  const current = playlist.tracks[player.queue.index];
  const deadEnd = allUnavailable(player.queue);

  return (
    <div>
      <h1 className="text-3xl font-semibold">
        {game.name}
        {game.year && <span className="ml-2 text-xl font-normal text-stone-500">({game.year})</span>}
      </h1>
      <p className="mt-1 text-sm text-stone-400">
        {playlist.tracks.length} tracks · {formatDuration(totalDurationSec(playlist.tracks))} ·{" "}
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
            <ControlButton label="Previous track" onClick={player.prev} disabled={!player.ready}>
              <SkipIcon direction="back" />
            </ControlButton>
            <button
              type="button"
              onClick={player.togglePlay}
              disabled={!player.ready || deadEnd}
              className="h-12 min-w-28 rounded-full bg-amber-500 px-6 font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-40"
            >
              {player.playing ? "Pause" : player.started ? "Resume" : "Play"}
            </button>
            <ControlButton label="Next track" onClick={player.next} disabled={!player.ready}>
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

        <ol className="max-h-[28rem] overflow-y-auto rounded-lg border border-stone-800 text-sm">
          {playlist.tracks.map((t, i) => {
            const isCurrent = player.started && i === player.queue.index;
            const isDead = player.queue.unavailable.has(i);
            return (
              <li key={`${t.source}:${t.sourceId}`}>
                <button
                  type="button"
                  onClick={() => player.playAt(i)}
                  disabled={!player.ready}
                  className={`flex w-full items-baseline gap-3 px-3 py-2 text-left hover:bg-stone-900 ${
                    isCurrent ? "bg-stone-900 text-amber-400" : ""
                  } ${isDead ? "text-stone-600 line-through" : ""}`}
                >
                  <span className="w-6 shrink-0 text-right text-stone-500">{i + 1}</span>
                  <span className="flex-1">
                    {t.title}
                    <span className="block text-xs text-stone-500">{t.channel}</span>
                  </span>
                  <span className="shrink-0 text-stone-500">{formatDuration(t.durationSec)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
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
