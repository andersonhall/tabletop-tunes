import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { trackKey } from "../backend/Backend";
import type { Track } from "../data/schema";
import type { MusicSource, MusicSourceFactory } from "../music/MusicSource";
import { watchAutoStart, type AutoStartWatch } from "./autoPlay";
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
  /** An auto-start didn't get going in time, most likely blocked by the browser until a click. */
  blocked: boolean;
  /** Starts the playlist without a press of play (auto-play). Does nothing once started. */
  autoStart(): void;
  togglePlay(): void;
  next(): void;
  prev(): void;
  playAt(index: number): void;
}

/**
 * Connects the pure queue to a music source rendered into `containerRef`.
 * `tracks` may change while playing (the user edits the playlist): the queue
 * follows the current track by key, and moves on if it was removed.
 */
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
  const [blocked, setBlocked] = useState(false);
  const watchRef = useRef<AutoStartWatch | undefined>(undefined);
  // Bumped on every navigation so the same index (e.g. a one-track playlist
  // looping) still reloads the track.
  const [playCount, setPlayCount] = useState(0);
  const sourceRef = useRef<MusicSource | null>(null);

  // An edit changed the list: re-point the queue during render, so the list
  // and the queue never disagree for even one frame.
  const [prevTracks, setPrevTracks] = useState(tracks);
  if (tracks !== prevTracks) {
    const { queue: q, currentRemoved } = Q.reconcile(queue, prevTracks.map(trackKey), tracks.map(trackKey));
    setPrevTracks(tracks);
    setQueue(q);
    if (currentRemoved && started) {
      // Playing: go straight on to the next track. Paused: don't let Resume
      // bring back the removed track; Play will start the new current one.
      if (playing) setPlayCount((n) => n + 1);
      else setStarted(false);
    }
  }

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
      onPlayingChange: (isPlaying) => {
        setPlaying(isPlaying);
        if (isPlaying) {
          watchRef.current?.playing();
          watchRef.current = undefined;
          setBlocked(false);
        }
      },
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
      watchRef.current?.cancel();
      watchRef.current = undefined;
      sourceRef.current?.destroy();
      sourceRef.current = null;
      container.replaceChildren();
    };
  }, [createSource, containerRef]);

  // Whenever playback moves to a track (after the first press of play), load it.
  useEffect(() => {
    const source = sourceRef.current;
    if (!started || !source) return;
    if (queue.length === 0 || Q.allUnavailable(queue)) {
      source.pause();
      setPlaying(false);
      return;
    }
    const track = tracksRef.current[queue.index];
    if (track) source.play(track.sourceId);
    // playCount (not queue or tracks) is the trigger, so reordering or adding
    // tracks never restarts the current one; both are read when it fires.
  }, [started, ready, playCount]);

  // Any press of a control takes over from a pending auto-start.
  const cancelWatch = () => {
    watchRef.current?.cancel();
    watchRef.current = undefined;
  };

  const autoStart = useCallback(() => {
    if (!sourceRef.current || started) return;
    setStarted(true);
    setPlayCount((n) => n + 1);
    watchRef.current?.cancel();
    watchRef.current = watchAutoStart(() => {
      watchRef.current = undefined;
      setBlocked(true);
    });
  }, [started]);

  const togglePlay = useCallback(() => {
    const source = sourceRef.current;
    if (!source) return;
    cancelWatch();
    if (!started) {
      setStarted(true);
      setPlayCount((n) => n + 1);
    } else if (playing) source.pause();
    else source.resume();
  }, [started, playing]);

  const go = useCallback((fn: (q: Q.QueueState) => Q.QueueState) => {
    cancelWatch();
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
    blocked,
    autoStart,
    togglePlay,
    next: () => go(Q.next),
    prev: () => go(Q.prev),
    playAt: (index) => go((q) => Q.jumpTo(q, index)),
  };
}
