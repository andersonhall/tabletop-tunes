import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Track } from "../data/schema";
import type { MusicSource, MusicSourceFactory } from "../music/MusicSource";
import * as Q from "./queue";

export interface PlayerApi {
  queue: Q.QueueState;
  /** True once the user has pressed play at least once for this playlist. */
  started: boolean;
  playing: boolean;
  ready: boolean;
  error: string | null;
  /** Most recent track skipped as unavailable, for a brief notice. */
  skipped: { title: string; reason: string } | null;
  togglePlay(): void;
  next(): void;
  prev(): void;
  playAt(index: number): void;
}

/** Connects the pure queue to a music source rendered into `containerRef`. */
export function usePlayer(
  tracks: readonly Track[],
  createSource: MusicSourceFactory,
  containerRef: RefObject<HTMLElement | null>,
): PlayerApi {
  const [queue, setQueue] = useState(() => Q.createQueue(tracks.length));
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<PlayerApi["skipped"]>(null);
  // Bumped on every navigation so the same index (e.g. a one-track playlist
  // looping) still reloads the track.
  const [playCount, setPlayCount] = useState(0);
  const sourceRef = useRef<MusicSource | null>(null);

  // Latest values for the source's event callbacks, which are bound once.
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    createSource(container, {
      onEnded: () => {
        setQueue((q) => Q.next(q));
        setPlayCount((n) => n + 1);
      },
      onUnavailable: (reason) => {
        const current = tracksRef.current[queueRef.current.index];
        console.warn(`Skipping unavailable track "${current?.title}": ${reason}`);
        if (current) setSkipped({ title: current.title, reason });
        setQueue((q) => Q.skipUnavailable(q));
        setPlayCount((n) => n + 1);
      },
      onPlayingChange: setPlaying,
    }).then(
      (source) => {
        if (cancelled) return source.destroy();
        sourceRef.current = source;
        setReady(true);
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      cancelled = true;
      sourceRef.current?.destroy();
      sourceRef.current = null;
      container.replaceChildren();
    };
  }, [createSource, containerRef]);

  // Whenever playback moves to a track (after the first press of play), load it.
  useEffect(() => {
    const source = sourceRef.current;
    if (!started || !source) return;
    if (Q.allUnavailable(queue)) {
      source.pause();
      setPlaying(false);
      return;
    }
    const track = tracks[queue.index];
    if (track) source.play(track.sourceId);
    // playCount (not queue) is the trigger; queue is read at the moment it fires.
  }, [started, ready, playCount, tracks]);

  const togglePlay = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    if (!started) {
      setStarted(true);
      setPlayCount((n) => n + 1);
    } else if (playing) source.pause();
    else source.resume();
  }, [started, playing]);

  const go = useCallback((fn: (q: Q.QueueState) => Q.QueueState) => {
    setStarted(true);
    setSkipped(null);
    setQueue(fn);
    setPlayCount((n) => n + 1);
  }, []);

  return {
    queue,
    started,
    playing,
    ready,
    error,
    skipped,
    togglePlay,
    next: () => go(Q.next),
    prev: () => go(Q.prev),
    playAt: (index) => go((q) => Q.jumpTo(q, index)),
  };
}
