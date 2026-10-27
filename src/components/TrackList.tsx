import { useState, type ReactNode } from "react";
import { trackKey } from "../backend/Backend";
import type { Track } from "../data/schema";
import { formatDuration } from "../format";
import type { PlayerApi } from "../player/usePlayer";

interface Editing {
  disabled: boolean;
  move(from: number, to: number): void;
  remove(track: Track): void;
  hide(track: Track): void;
}

/** For a Melodice alternate: each row can be kept into the user's own playlist. */
interface Keeping {
  disabled: boolean;
  isKept(track: Track): boolean;
  keep(track: Track): void;
}

/**
 * The playlist's tracks. With `editing`, each row can also be moved, dragged,
 * removed, or hidden; with `keeping`, kept.
 */
export function TrackList(props: { tracks: readonly Track[]; player: PlayerApi; editing?: Editing; keeping?: Keeping }) {
  const { tracks, player, editing, keeping } = props;
  const [dragFrom, setDragFrom] = useState<number>();
  const [dragOver, setDragOver] = useState<number>();
  const canDrag = !!editing && !editing.disabled;

  function endDrag() {
    setDragFrom(undefined);
    setDragOver(undefined);
  }

  return (
    <ol className="max-h-[28rem] overflow-y-auto rounded-lg border border-stone-800 text-sm">
      {tracks.map((t, i) => {
        const isCurrent = player.started && i === player.queue.index;
        const isDead = player.queue.unavailable.has(i);
        const dropMark =
          dragFrom !== undefined && dragOver === i && dragFrom !== i
            ? dragFrom < i
              ? "border-b-2 border-b-amber-500"
              : "border-t-2 border-t-amber-500"
            : "";
        return (
          <li
            key={trackKey(t)}
            draggable={canDrag}
            onDragStart={(e) => {
              setDragFrom(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragFrom === undefined) return;
              e.preventDefault();
              setDragOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (editing && dragFrom !== undefined && dragFrom !== i) editing.move(dragFrom, i);
              endDrag();
            }}
            onDragEnd={endDrag}
            className={`group flex items-stretch ${dropMark} ${dragFrom === i ? "opacity-40" : ""}`}
          >
            {editing && (
              <span
                title="Drag to reorder"
                aria-hidden="true"
                className={`flex w-5 shrink-0 items-center justify-center text-stone-600 ${
                  canDrag ? "cursor-grab group-hover:text-stone-400" : ""
                }`}
              >
                <GripIcon />
              </span>
            )}
            <button
              type="button"
              onClick={() => player.playAt(i)}
              disabled={!player.ready}
              className={`flex min-w-0 flex-1 items-baseline gap-3 py-2 text-left hover:bg-stone-900 ${
                editing ? "pl-1 pr-2" : "px-3"
              } ${isCurrent ? "bg-stone-900 text-amber-400" : ""} ${isDead ? "text-stone-600 line-through" : ""}`}
            >
              <span className="w-6 shrink-0 text-right text-stone-500">{i + 1}</span>
              <span className="min-w-0 flex-1">
                {t.title}
                <span className="block text-xs text-stone-500">{t.channel}</span>
              </span>
              <span className="shrink-0 text-stone-500">{t.durationSec > 0 && formatDuration(t.durationSec)}</span>
            </button>
            {editing && (
              <span className="flex shrink-0 items-center gap-0.5 pr-1.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100">
                <span className="flex flex-col">
                  <RowButton
                    label="Move up"
                    disabled={editing.disabled || i === 0}
                    onClick={() => editing.move(i, i - 1)}
                    small
                  >
                    <ChevronIcon up />
                  </RowButton>
                  <RowButton
                    label="Move down"
                    disabled={editing.disabled || i === tracks.length - 1}
                    onClick={() => editing.move(i, i + 1)}
                    small
                  >
                    <ChevronIcon />
                  </RowButton>
                </span>
                <RowButton label="Remove from this playlist" disabled={editing.disabled} onClick={() => editing.remove(t)}>
                  <CrossIcon />
                </RowButton>
                <RowButton label="Hide from all my playlists" disabled={editing.disabled} onClick={() => editing.hide(t)}>
                  <EyeOffIcon />
                </RowButton>
              </span>
            )}
            {keeping && (
              <span className="flex shrink-0 items-center pr-2">
                {keeping.isKept(t) ? (
                  <span className="text-xs text-stone-500">Kept</span>
                ) : (
                  <button
                    type="button"
                    title="Add to my playlist for this game"
                    disabled={keeping.disabled}
                    onClick={() => keeping.keep(t)}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-amber-400 opacity-70 hover:bg-stone-800 hover:text-amber-300 group-hover:opacity-100 focus:opacity-100 disabled:opacity-30"
                  >
                    Keep
                  </button>
                )}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function RowButton(props: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`flex items-center justify-center rounded text-stone-400 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-30 disabled:hover:bg-transparent ${
        props.small ? "h-4 w-6" : "h-7 w-7"
      }`}
    >
      {props.children}
    </button>
  );
}

// Icons are SVG so they don't render as color emoji.

function GripIcon() {
  return (
    <svg viewBox="0 0 10 16" className="h-4 w-2.5 fill-current">
      {[3, 8, 13].flatMap((y) => [<circle key={`a${y}`} cx="2.5" cy={y} r="1.3" />, <circle key={`b${y}`} cx="7.5" cy={y} r="1.3" />])}
    </svg>
  );
}

function ChevronIcon({ up = false }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 16 10" aria-hidden="true" className={`h-2.5 w-3.5 ${up ? "" : "rotate-180"}`}>
      <path d="M2 8l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
