import { describe, expect, it, vi } from "vitest";
import { createStaticPlaylistStore } from "./playlistStore";

const valid = (name: string, slug: string) => ({
  schemaVersion: 1,
  game: { bggId: 1, name, year: null, slug },
  playlist: {
    id: `${slug}-default`,
    ownerId: "andy",
    generatedBy: "claude-code",
    createdAt: "2026-10-19",
    tracks: [{ source: "youtube", sourceId: "abc", title: "t", channel: "c", durationSec: 4000 }],
  },
});

describe("createStaticPlaylistStore", () => {
  it("lists valid games alphabetically and looks them up by slug", () => {
    const store = createStaticPlaylistStore({ "z.json": valid("Zoo", "zoo"), "a.json": valid("Ark", "ark") });
    expect(store.listGames().map((g) => g.game.name)).toEqual(["Ark", "Zoo"]);
    expect(store.getGame("zoo")?.game.name).toBe("Zoo");
    expect(store.getGame("missing")).toBeUndefined();
  });

  it("skips invalid files instead of crashing the app", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = createStaticPlaylistStore({ "bad.json": { nope: true }, "a.json": valid("Ark", "ark") });
    expect(store.listGames()).toHaveLength(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
