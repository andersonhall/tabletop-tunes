// Pure playback-order logic, independent of any music source.
//
// The queue tracks which track is current and which tracks have turned out to
// be unavailable at play time, so the player can skip them and keep going.
//
// Shuffle is a play order on top of the track list: the list (the user's saved
// playlist) never changes, only the order the queue walks it in.

export interface QueueState {
  length: number;
  index: number;
  /** Indexes found unavailable this session (removed/blocked videos). */
  unavailable: ReadonlySet<number>;
  /** Present while shuffle is on. */
  shuffle?: ShuffleState;
}

export interface ShuffleState {
  /** Tracks actually played, oldest first, across passes. `history[cursor]` is the current track. */
  history: readonly number[];
  /** Where Previous/Next are in `history`; behind the end after pressing Previous. */
  cursor: number;
  /** This pass's tracks that haven't played yet, in the order they'll play. */
  upcoming: readonly number[];
}

export type Rng = () => number;

/** Enough for Previous to go back a whole game night without growing forever. */
const HISTORY_LIMIT = 500;

export function createQueue(length: number, index = 0): QueueState {
  return { length, index: clamp(index, length), unavailable: new Set() };
}

function clamp(index: number, length: number): number {
  return length === 0 ? 0 : Math.min(Math.max(index, 0), length - 1);
}

export function allUnavailable(q: QueueState): boolean {
  return q.length > 0 && q.unavailable.size >= q.length;
}

/** Steps from the current index in `dir`, wrapping around, skipping unavailable tracks. */
function step(q: QueueState, dir: 1 | -1): QueueState {
  if (q.length === 0 || allUnavailable(q)) return q;
  let i = q.index;
  for (let n = 0; n < q.length; n++) {
    i = (i + dir + q.length) % q.length;
    if (!q.unavailable.has(i)) return { ...q, index: i };
  }
  return q;
}

/**
 * Next track; after the last track, loops back to the first. Shuffled: back
 * forward through history after Previous, then the next unplayed track, and a
 * fresh order once every track has played.
 */
export function next(q: QueueState, rng: Rng = Math.random): QueueState {
  const s = q.shuffle;
  if (!s) return step(q, 1);
  if (q.length === 0 || allUnavailable(q)) return q;
  for (let c = s.cursor + 1; c < s.history.length; c++) {
    const index = s.history[c];
    if (!q.unavailable.has(index)) return { ...q, index, shuffle: { ...s, cursor: c } };
  }
  let upcoming = s.upcoming;
  let i = upcoming.findIndex((n) => !q.unavailable.has(n));
  if (i === -1) {
    // Every track has played: a new pass, not starting with the one just heard.
    const order = shuffled(playable(q), rng);
    if (order.length > 1 && order[0] === q.index) {
      const j = 1 + Math.floor(rng() * (order.length - 1));
      [order[0], order[j]] = [order[j], order[0]];
    }
    upcoming = order;
    i = 0;
  }
  return played(q, upcoming[i], s.history.slice(0, s.cursor + 1), upcoming.slice(i + 1));
}

/**
 * Previous track; before the first track, wraps to the last. Shuffled: the
 * track that actually played before, back through earlier passes too.
 */
export function prev(q: QueueState): QueueState {
  const s = q.shuffle;
  if (!s) return step(q, -1);
  for (let c = s.cursor - 1; c >= 0; c--) {
    const index = s.history[c];
    if (!q.unavailable.has(index)) return { ...q, index, shuffle: { ...s, cursor: c } };
  }
  return q;
}

/**
 * Jumps straight to a track (e.g. clicked in the list), even if previously
 * unavailable. Shuffled, the rest of the pass carries on after it.
 */
export function jumpTo(q: QueueState, index: number): QueueState {
  if (index < 0 || index >= q.length) return q;
  const unavailable = new Set(q.unavailable);
  unavailable.delete(index);
  const s = q.shuffle;
  if (!s) return { ...q, index, unavailable };
  // Clicking the current track just restarts it; don't list it twice.
  if (s.history[s.cursor] === index) return { ...q, unavailable };
  return played(
    { ...q, unavailable },
    index,
    s.history.slice(0, s.cursor + 1),
    s.upcoming.filter((n) => n !== index),
  );
}

/** Marks the current track unavailable and advances to the next playable one. */
export function skipUnavailable(q: QueueState, rng: Rng = Math.random): QueueState {
  const unavailable = new Set(q.unavailable);
  unavailable.add(q.index);
  return next({ ...q, unavailable }, rng);
}

/**
 * Turns shuffle on or off without changing the current track. On: the other
 * tracks play next in a random order. Off: playback continues in saved order.
 */
export function setShuffle(q: QueueState, on: boolean, rng: Rng = Math.random): QueueState {
  if (!on) {
    if (!q.shuffle) return q;
    const { shuffle: _, ...rest } = q;
    return rest;
  }
  if (q.shuffle) return q;
  const others = range(q.length).filter((i) => i !== q.index);
  const history = q.length === 0 ? [] : [q.index];
  return { ...q, shuffle: { history, cursor: history.length - 1, upcoming: shuffled(others, rng) } };
}

/**
 * Starts shuffled playback afresh, at `first` or at a random playable track,
 * so starting a game's playlist doesn't always begin with track 1.
 */
export function shuffleStart(q: QueueState, rng: Rng = Math.random, first?: number): QueueState {
  if (q.length === 0) return setShuffle(q, true, rng);
  const order = shuffled(playable(q), rng);
  const start = first ?? order[0] ?? q.index;
  return {
    ...q,
    index: start,
    shuffle: { history: [start], cursor: 0, upcoming: order.filter((n) => n !== start) },
  };
}

/** Moves to `index` as a newly played track, after `history`. */
function played(q: QueueState, index: number, history: readonly number[], upcoming: readonly number[]): QueueState {
  const h = [...history, index].slice(-HISTORY_LIMIT);
  return { ...q, index, shuffle: { history: h, cursor: h.length - 1, upcoming } };
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function playable(q: QueueState): number[] {
  return range(q.length).filter((i) => !q.unavailable.has(i));
}

/** A random permutation (Fisher-Yates) of a copy of `items`. */
function shuffled(items: readonly number[], rng: Rng): number[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Follows the track list after an edit (remove, reorder, add). Tracks are
 * matched by key, so the current track and unavailable marks move with their
 * tracks. If the current track was removed, the queue lands on whatever took
 * its place (the next track), and `currentRemoved` is set.
 *
 * Shuffled, removed tracks leave the history and the unplayed tracks, added
 * tracks join the unplayed ones, and a removed current track gives way to the
 * next track in shuffle order.
 */
export function reconcile(
  q: QueueState,
  oldKeys: readonly string[],
  newKeys: readonly string[],
  rng: Rng = Math.random,
): { queue: QueueState; currentRemoved: boolean } {
  const result = reconcileOrdered(q, oldKeys, newKeys);
  const s = q.shuffle;
  if (!s) return result;

  const indexOf = new Map(newKeys.map((k, i) => [k, i]));
  const moved = (i: number) => indexOf.get(oldKeys[i] ?? "");
  const history: number[] = [];
  let keptBefore = 0;
  s.history.forEach((i, c) => {
    const m = moved(i);
    if (m === undefined) return;
    history.push(m);
    if (c < s.cursor) keptBefore++;
  });
  const upcoming = s.upcoming.map(moved).filter((m): m is number => m !== undefined);
  const old = new Set(oldKeys);
  newKeys.forEach((k, i) => {
    if (!old.has(k)) upcoming.splice(Math.floor(rng() * (upcoming.length + 1)), 0, i);
  });

  const { queue, currentRemoved } = result;
  if (newKeys.length === 0) {
    return { queue: { ...queue, shuffle: { history: [], cursor: -1, upcoming: [] } }, currentRemoved };
  }
  if (moved(q.index) !== undefined) {
    return { queue: { ...queue, shuffle: { history, cursor: keptBefore, upcoming } }, currentRemoved };
  }
  // The current track is gone: carry on from the track before it.
  const before = { ...queue, shuffle: { history, cursor: keptBefore - 1, upcoming } };
  return { queue: next(before, rng), currentRemoved };
}

function reconcileOrdered(
  q: QueueState,
  oldKeys: readonly string[],
  newKeys: readonly string[],
): { queue: QueueState; currentRemoved: boolean } {
  const indexOf = new Map(newKeys.map((k, i) => [k, i]));
  const unavailable = new Set<number>();
  for (const i of q.unavailable) {
    const moved = indexOf.get(oldKeys[i] ?? "");
    if (moved !== undefined) unavailable.add(moved);
  }
  const currentKey = oldKeys[q.index];
  const found = currentKey === undefined ? undefined : indexOf.get(currentKey);
  if (found !== undefined) {
    return { queue: { length: newKeys.length, index: found, unavailable }, currentRemoved: false };
  }
  // Tracks before the removed one keep their place, so its old position now
  // holds the track that followed it (wrapping to the start after the last).
  const index = newKeys.length === 0 ? 0 : q.index >= newKeys.length ? 0 : q.index;
  return { queue: { length: newKeys.length, index, unavailable }, currentRemoved: currentKey !== undefined };
}
