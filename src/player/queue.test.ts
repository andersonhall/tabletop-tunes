import { describe, expect, it } from "vitest";
import { allUnavailable, createQueue, jumpTo, next, prev, skipUnavailable } from "./queue";

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
