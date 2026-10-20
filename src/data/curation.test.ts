import { describe, expect, it } from "vitest";
import type { SavedPlaylist } from "../backend/Backend";
import { appendTrack, basedOnId, checkAdd, moveTrack, removeTrack, visibleTracks } from "./curation";
import type { Playlist, Track } from "./schema";

const track = (id: string): Track => ({
  source: "youtube",
  sourceId: id,
  title: `Track ${id}`,
  channel: "Channel",
  durationSec: 300,
});

const generated = (ids: string[], createdAt = "2026-10-01"): Playlist => ({
  id: "cascadia-default",
  ownerId: "andy",
  generatedBy: "claude-code",
  createdAt,
  tracks: ids.map(track),
});

const ids = (tracks: readonly Track[]) => tracks.map((t) => t.sourceId);
const none = new Set<string>();

describe("visibleTracks", () => {
  it("follows the generated playlist for a game the user hasn't edited, including after a regeneration", () => {
    expect(ids(visibleTracks(generated(["a", "b"]), undefined, none))).toEqual(["a", "b"]);
    expect(ids(visibleTracks(generated(["c", "d"], "2026-11-01"), undefined, none))).toEqual(["c", "d"]);
  });

  it("uses the user's copy once there is one, so a regeneration doesn't change it", () => {
    const saved: SavedPlaylist = { gameSlug: "cascadia", basedOn: "x", tracks: [track("b"), track("a")] };
    expect(ids(visibleTracks(generated(["c", "d"], "2026-11-01"), saved, none))).toEqual(["b", "a"]);
  });

  it("leaves out hidden tracks, from generated playlists and copies alike", () => {
    const hidden = new Set(["youtube:a"]);
    const saved: SavedPlaylist = { gameSlug: "cascadia", basedOn: "x", tracks: [track("a"), track("z")] };
    expect(ids(visibleTracks(generated(["a", "b"]), undefined, hidden))).toEqual(["b"]);
    expect(ids(visibleTracks(generated(["a", "b"]), saved, hidden))).toEqual(["z"]);
  });
});

describe("editing", () => {
  const list = ["a", "b", "c"].map(track);

  it("records which generated playlist a copy came from", () => {
    expect(basedOnId(generated(["a"]))).toBe("cascadia-default@2026-10-01");
  });

  it("removes a track by key", () => {
    expect(ids(removeTrack(list, "youtube:b"))).toEqual(["a", "c"]);
  });

  it("moves a track up, down, and across the list", () => {
    expect(ids(moveTrack(list, 1, 0))).toEqual(["b", "a", "c"]);
    expect(ids(moveTrack(list, 1, 2))).toEqual(["a", "c", "b"]);
    expect(ids(moveTrack(list, 0, 2))).toEqual(["b", "c", "a"]);
  });

  it("ignores moves past either end", () => {
    expect(ids(moveTrack(list, 0, -1))).toEqual(["a", "b", "c"]);
    expect(ids(moveTrack(list, 2, 3))).toEqual(["a", "b", "c"]);
  });

  it("appends to the end without changing the original", () => {
    expect(ids(appendTrack(list, track("d")))).toEqual(["a", "b", "c", "d"]);
    expect(ids(list)).toEqual(["a", "b", "c"]);
  });
});

describe("checkAdd", () => {
  const list = ["a", "b"].map(track);

  it("accepts a new track", () => {
    expect(checkAdd(list, none, track("c"))).toBe("ok");
  });

  it("spots a track that's already in the playlist", () => {
    expect(checkAdd(list, none, track("a"))).toBe("duplicate");
  });

  it("spots a track that's hidden everywhere", () => {
    expect(checkAdd(list, new Set(["youtube:c"]), track("c"))).toBe("hidden");
  });
});
