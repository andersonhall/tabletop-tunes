import { useCallback, useEffect, useMemo, useState } from "react";
import type { Track } from "../data/schema";
import {
  alternateStore,
  alternateTracks,
  newAlternate,
  pendingIds,
  type Alternate,
  type Resolved,
} from "../melodice/alternateStore";
import type { TrackResolver } from "../music/MusicSource";

/** How many hidden players probe Melodice's ids at once. */
const CONCURRENCY = 3;

export interface AlternateApi {
  /** A Melodice list is loaded for this game (selected or not). */
  exists: boolean;
  /** The Melodice list is the one selected. */
  active: boolean;
  tracks: Track[];
  /** Ids still being probed for their title and length. */
  pending: number;
  /** It was just sent or pasted, so it should start playing once. */
  fresh: boolean;
  load(ids: string[]): void;
  setActive(active: boolean): void;
  close(): void;
  /** The full track for `track` (which may be a placeholder), or why it can't play. */
  details(track: Track): Promise<Resolved>;
}

/**
 * A game's Melodice alternate: kept in sessionStorage, with each id probed in
 * the background (no API key needed) and the result cached there too, so a
 * reload doesn't probe again.
 */
export function useAlternate(slug: string, hidden: ReadonlySet<string>, resolver: TrackResolver): AlternateApi {
  const [alt, setAlt] = useState<Alternate | undefined>(() => alternateStore.get(slug));
  // Read once: a reload of an old alternate shouldn't force it to start.
  const [fresh] = useState(() => !!alt?.fresh);

  const update = useCallback(
    (fn: (a: Alternate | undefined) => Alternate | undefined) => {
      setAlt((a) => {
        const next = fn(a);
        if (next) alternateStore.set(slug, next);
        else alternateStore.remove(slug);
        return next;
      });
    },
    [slug],
  );

  useEffect(() => {
    if (fresh) update((a) => a && { ...a, fresh: false });
  }, [fresh, update]);

  const ids = alt?.ids;
  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    const queue = pendingIds(alternateStore.get(slug) ?? newAlternate(ids));
    const worker = async () => {
      while (!cancelled && queue.length) {
        const id = queue.shift()!;
        const r = await resolver.resolve({ source: "youtube", sourceId: id });
        if (cancelled) return;
        const result: Resolved = r.ok ? r.track : { failed: r.reason };
        // Only into the list it was probed for, not one pasted since.
        update((a) => (a && a.ids === ids ? { ...a, resolved: { ...a.resolved, [id]: result } } : a));
      }
    };
    for (let i = 0; i < CONCURRENCY; i++) void worker();
    return () => {
      cancelled = true;
    };
  }, [ids, slug, resolver, update]);

  const tracks = useMemo(() => (alt ? alternateTracks(alt, hidden) : []), [alt, hidden]);

  return {
    exists: !!alt,
    active: !!alt?.active,
    tracks,
    pending: alt ? pendingIds(alt).length : 0,
    fresh,
    load: (next) => update(() => newAlternate(next, false)),
    setActive: (active) => update((a) => a && { ...a, active }),
    close: () => update(() => undefined),
    async details(track) {
      const known = alt?.resolved[track.sourceId];
      if (known) return known;
      const r = await resolver.resolve(track);
      return r.ok ? r.track : { failed: r.reason };
    },
  };
}
