import { describe, expect, it } from "vitest";
import type { Track } from "../data/schema";
import {
  alternateTracks,
  createAlternateStore,
  newAlternate,
  pendingIds,
  PLACEHOLDER_TITLE,
  type KeyValueStorage,
} from "./alternateStore";

function fakeStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const track = (id: string): Track => ({ source: "youtube", sourceId: id, title: id, channel: "c", durationSec: 60 });

describe("alternateStore", () => {
  it("round-trips through storage, per game", () => {
    const storage = fakeStorage();
    const store = createAlternateStore(() => storage);
    store.set("agricola", newAlternate(["a"]));
    expect(createAlternateStore(() => storage).get("agricola")).toEqual(newAlternate(["a"]));
    expect(store.get("azul")).toBeUndefined();
    store.remove("agricola");
    expect(storage.data.size).toBe(0);
  });

  it("falls back to memory when storage throws", () => {
    const store = createAlternateStore(() => {
      throw new Error("blocked");
    });
    store.set("agricola", newAlternate(["a"]));
    expect(store.get("agricola")?.ids).toEqual(["a"]);
    store.remove("agricola");
    expect(store.get("agricola")).toBeUndefined();
  });
});

describe("alternateTracks", () => {
  it("keeps Melodice's order, drops hidden and failed ids, and stands in for pending ones", () => {
    const alt = {
      ...newAlternate(["a", "b", "c", "d"]),
      resolved: { a: track("a"), b: { failed: "private" }, d: track("d") },
    };
    const out = alternateTracks(alt, new Set(["youtube:d"]));
    expect(out.map((t) => t.sourceId)).toEqual(["a", "c"]);
    expect(out[1]).toMatchObject({ title: PLACEHOLDER_TITLE, durationSec: 0 });
    expect(pendingIds(alt)).toEqual(["c"]);
  });
});
