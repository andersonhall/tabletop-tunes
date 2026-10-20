// Pure playback-order logic, independent of any music source.
//
// The queue tracks which track is current and which tracks have turned out to
// be unavailable at play time, so the player can skip them and keep going.

export interface QueueState {
  length: number;
  index: number;
  /** Indexes found unavailable this session (removed/blocked videos). */
  unavailable: ReadonlySet<number>;
}

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

/** Next track; after the last track, loops back to the first. */
export function next(q: QueueState): QueueState {
  return step(q, 1);
}

/** Previous track; before the first track, wraps to the last. */
export function prev(q: QueueState): QueueState {
  return step(q, -1);
}

/** Jumps straight to a track (e.g. clicked in the list), even if previously unavailable. */
export function jumpTo(q: QueueState, index: number): QueueState {
  if (index < 0 || index >= q.length) return q;
  const unavailable = new Set(q.unavailable);
  unavailable.delete(index);
  return { ...q, index, unavailable };
}

/** Marks the current track unavailable and advances to the next playable one. */
export function skipUnavailable(q: QueueState): QueueState {
  const unavailable = new Set(q.unavailable);
  unavailable.add(q.index);
  return step({ ...q, unavailable }, 1);
}

/**
 * Follows the track list after an edit (remove, reorder, add). Tracks are
 * matched by key, so the current track and unavailable marks move with their
 * tracks. If the current track was removed, the queue lands on whatever took
 * its place (the next track), and `currentRemoved` is set.
 */
export function reconcile(
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
