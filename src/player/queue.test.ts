import { describe, expect, it } from "vitest";
import {
  allUnavailable,
  createQueue,
  jumpTo,
  next,
  prev,
  reconcile,
  setShuffle,
  shuffleStart,
  skipUnavailable,
  type QueueState,
  type Rng,
} from "./queue";

describe("queue", () => {
  it("advances track after track", () => {
    let q = createQueue(3);
    q = next(q);
    expect(q.index).toBe(1);
    q = next(q);
    expect(q.index).toBe(2);
  });

  it("loops back to the first track after the last", () => {
    expect(next(createQueue(3, 2)).index).toBe(0);
  });

  it("prev goes back, wrapping to the last track from the first", () => {
    expect(prev(createQueue(3, 2)).index).toBe(1);
    expect(prev(createQueue(3, 0)).index).toBe(2);
  });

  it("a one-track playlist loops onto itself", () => {
    expect(next(createQueue(1)).index).toBe(0);
  });

  it("skips an unavailable track and keeps going", () => {
    const q = skipUnavailable(createQueue(4, 1));
    expect(q.index).toBe(2);
    expect(q.unavailable.has(1)).toBe(true);
  });

  it("next/prev step over tracks already found unavailable", () => {
    let q = skipUnavailable(createQueue(4, 1)); // 1 dead, now at 2
    q = prev(q);
    expect(q.index).toBe(0);
    q = next(q);
    expect(q.index).toBe(2);
  });

  it("skipping the last track wraps to the first playable one", () => {
    let q = skipUnavailable(createQueue(3, 0)); // 0 dead, at 1
    q = jumpTo(q, 2);
    q = skipUnavailable(q); // 2 dead, wraps past 0 to 1
    expect(q.index).toBe(1);
  });

  it("detects when every track is unavailable instead of looping forever", () => {
    let q = createQueue(2);
    q = skipUnavailable(q);
    expect(allUnavailable(q)).toBe(false);
    q = skipUnavailable(q);
    expect(allUnavailable(q)).toBe(true);
    expect(next(q)).toBe(q);
  });

  it("jumpTo lets you retry a track that was marked unavailable", () => {
    let q = skipUnavailable(createQueue(3, 0));
    q = jumpTo(q, 0);
    expect(q.index).toBe(0);
    expect(q.unavailable.has(0)).toBe(false);
  });

  it("jumpTo ignores out-of-range indexes", () => {
    const q = createQueue(3);
    expect(jumpTo(q, 5)).toBe(q);
  });
});

describe("reconcile", () => {
  const keys = ["a", "b", "c", "d"];

  it("keeps playing the same track when the list is reordered", () => {
    const { queue, currentRemoved } = reconcile(createQueue(4, 1), keys, ["b", "a", "c", "d"]);
    expect(queue.index).toBe(0);
    expect(currentRemoved).toBe(false);
  });

  it("keeps the current track when another one is removed before it", () => {
    const { queue } = reconcile(createQueue(4, 2), keys, ["a", "c", "d"]);
    expect(queue).toMatchObject({ length: 3, index: 1 });
  });

  it("moves on to the next track when the current one is removed", () => {
    const { queue, currentRemoved } = reconcile(createQueue(4, 1), keys, ["a", "c", "d"]);
    expect(queue.index).toBe(1);
    expect(currentRemoved).toBe(true);
  });

  it("wraps to the first track when the last one is removed while current", () => {
    const { queue, currentRemoved } = reconcile(createQueue(4, 3), keys, ["a", "b", "c"]);
    expect(queue.index).toBe(0);
    expect(currentRemoved).toBe(true);
  });

  it("keeps unavailable marks on the tracks they belong to", () => {
    const q = skipUnavailable(createQueue(4, 2)); // c unavailable, now on d
    const { queue } = reconcile(q, keys, ["c", "a", "b", "d", "e"]);
    expect([...queue.unavailable]).toEqual([0]);
    expect(queue.index).toBe(3);
    expect(queue.length).toBe(5);
  });
});

/** A small seeded generator (mulberry32), so shuffled orders are repeatable. */
function seeded(seed: number): Rng {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The current track, then the next `count - 1` tracks Next lands on. */
function playOrder(q: QueueState, count: number, rng: Rng): { order: number[]; queue: QueueState } {
  const order = [q.index];
  for (let n = 1; n < count; n++) {
    q = next(q, rng);
    order.push(q.index);
  }
  return { order, queue: q };
}

const sorted = (a: number[]) => [...a].sort((x, y) => x - y);

describe("shuffle", () => {
  it("plays every track once per pass, in a random order", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = seeded(seed);
      const { order } = playOrder(shuffleStart(createQueue(8), rng), 8, rng);
      expect(sorted(order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    }
    const orders = new Set(
      [1, 2, 3, 4, 5].map((seed) => playOrder(shuffleStart(createQueue(8), seeded(seed)), 8, seeded(seed)).order.join()),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("starts at a random track rather than always track 1", () => {
    const starts = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => shuffleStart(createQueue(6), seeded(seed)).index));
    expect(starts.size).toBeGreaterThan(1);
  });

  it("can start at a chosen track (clicked before playing)", () => {
    const q = shuffleStart(createQueue(5), seeded(1), 3);
    expect(q.index).toBe(3);
    const { order } = playOrder(q, 5, seeded(2));
    expect(sorted(order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("wraps into a new order that doesn't start with the track just played", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seeded(seed);
      const { order: first, queue } = playOrder(shuffleStart(createQueue(4), rng), 4, rng);
      const second = playOrder(next(queue, rng), 4, rng).order;
      expect(sorted(second)).toEqual([0, 1, 2, 3]);
      expect(second[0]).not.toBe(first[3]);
    }
  });

  it("a one-track playlist still loops onto itself", () => {
    const q = shuffleStart(createQueue(1), seeded(1));
    expect(next(next(q)).index).toBe(0);
  });

  it("Previous goes back through what actually played, across passes", () => {
    const rng = seeded(3);
    const { order: first, queue } = playOrder(shuffleStart(createQueue(3), rng), 3, rng);
    const { order: second, queue: q } = playOrder(next(queue, rng), 2, rng);
    const played = [...first, ...second];
    let back = q;
    for (let i = played.length - 2; i >= 0; i--) {
      back = prev(back);
      expect(back.index).toBe(played[i]);
    }
    expect(prev(back)).toBe(back); // nothing before the first track
  });

  it("Next after Previous replays forward through history, then carries on", () => {
    const rng = seeded(4);
    const { order, queue } = playOrder(shuffleStart(createQueue(5), rng), 3, rng);
    let q = prev(prev(queue));
    expect(q.index).toBe(order[0]);
    q = next(q, rng);
    expect(q.index).toBe(order[1]);
    q = next(q, rng);
    expect(q.index).toBe(order[2]);
    const rest = playOrder(next(q, rng), 2, rng).order;
    expect(sorted([...order, ...rest])).toEqual([0, 1, 2, 3, 4]);
  });

  it("clicking a track plays it, then the pass continues through unplayed tracks", () => {
    const rng = seeded(5);
    let q = shuffleStart(createQueue(6), rng);
    const firstTrack = q.index;
    const clicked = q.shuffle!.upcoming[3];
    q = jumpTo(q, clicked);
    expect(q.index).toBe(clicked);
    const { order } = playOrder(q, 5, rng);
    expect(sorted([firstTrack, ...order])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(prev(q).index).toBe(firstTrack);
  });

  it("clicking the current track doesn't add it to history twice", () => {
    let q = shuffleStart(createQueue(4), seeded(6));
    q = next(q, seeded(6));
    const before = prev(q).index;
    q = jumpTo(q, q.index);
    expect(prev(q).index).toBe(before);
  });

  it("skips unavailable tracks in shuffle order", () => {
    const rng = seeded(7);
    let q = shuffleStart(createQueue(5), rng);
    const upcoming = q.shuffle!.upcoming;
    q = next(q, rng); // upcoming[0]
    q = skipUnavailable(q, rng); // marks it, moves on
    expect(q.index).toBe(upcoming[1]);
    expect(q.unavailable.has(upcoming[0])).toBe(true);
    expect(prev(q).index).not.toBe(upcoming[0]); // Previous steps over it too
  });

  it("never plays unavailable tracks in later passes", () => {
    const rng = seeded(8);
    const q = skipUnavailable(shuffleStart(createQueue(4), rng), rng);
    const dead = [...q.unavailable][0];
    const { order } = playOrder(q, 9, rng);
    expect(order).not.toContain(dead);
  });

  it("turning shuffle on keeps the current track and shuffles the rest", () => {
    const rng = seeded(9);
    const q = setShuffle(createQueue(6, 2), true, rng);
    expect(q.index).toBe(2);
    const { order } = playOrder(q, 6, rng);
    expect(sorted(order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(order[0]).toBe(2);
  });

  it("turning shuffle off keeps the current track and continues in saved order", () => {
    const rng = seeded(10);
    let q = next(next(shuffleStart(createQueue(6), rng), rng), rng);
    const current = q.index;
    q = setShuffle(q, false);
    expect(q.shuffle).toBeUndefined();
    expect(q.index).toBe(current);
    expect(next(q).index).toBe((current + 1) % 6);
  });
});

describe("reconcile while shuffled", () => {
  const keys = ["a", "b", "c", "d", "e"];

  it("keeps the current track and the rest of the order when the list is reordered", () => {
    const rng = seeded(11);
    const q = shuffleStart(createQueue(5), rng);
    const { order: expected } = playOrder(q, 5, seeded(99));
    const newKeys = ["e", "d", "c", "b", "a"];
    const { queue, currentRemoved } = reconcile(q, keys, newKeys, rng);
    expect(currentRemoved).toBe(false);
    expect(newKeys[queue.index]).toBe(keys[q.index]);
    const { order } = playOrder(queue, 5, seeded(99));
    expect(order.map((i) => newKeys[i])).toEqual(expected.map((i) => keys[i]));
  });

  it("removed tracks never play, and history skips them", () => {
    const rng = seeded(12);
    const q = next(shuffleStart(createQueue(5), rng), rng);
    const removed = keys[q.shuffle!.upcoming[0]];
    const previous = keys[prev(q).index];
    const newKeys = keys.filter((k) => k !== removed);
    const { queue } = reconcile(q, keys, newKeys, rng);
    const { order } = playOrder(queue, 4, rng);
    expect(order.map((i) => newKeys[i])).not.toContain(removed);
    expect(newKeys[prev(queue).index]).toBe(previous);
  });

  it("moves on in shuffle order when the current track is removed", () => {
    const rng = seeded(13);
    const q = shuffleStart(createQueue(5), rng);
    const nextUp = keys[q.shuffle!.upcoming[0]];
    const newKeys = keys.filter((k) => k !== keys[q.index]);
    const { queue, currentRemoved } = reconcile(q, keys, newKeys, rng);
    expect(currentRemoved).toBe(true);
    expect(newKeys[queue.index]).toBe(nextUp);
  });

  it("added tracks join this pass's unplayed tracks", () => {
    const rng = seeded(14);
    const q = next(shuffleStart(createQueue(5), rng), rng);
    const newKeys = [...keys, "f", "g"];
    const { queue } = reconcile(q, keys, newKeys, rng);
    expect(newKeys[queue.index]).toBe(keys[q.index]);
    const { order } = playOrder(queue, 6, rng); // current + 3 unplayed + 2 added
    const played = [keys[prev(q).index], ...order.map((i) => newKeys[i])];
    expect([...played].sort()).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });
});
