import { describe, expect, it } from "vitest";
import { buildReport, formatReport } from "./checkPlaylists";
import type { GameFile } from "../../src/data/schema";
import type { VideoCheck } from "./youtubeParse";

function game(slug: string, tracks: [id: string, durationSec: number][]): GameFile {
  return {
    schemaVersion: 1,
    game: { bggId: 1, name: slug.toUpperCase(), year: 2020, slug },
    playlist: {
      id: `${slug}-default`,
      ownerId: "andy",
      generatedBy: "claude-code",
      createdAt: "2026-01-01",
      tracks: tracks.map(([id, durationSec]) => ({
        source: "youtube",
        sourceId: id,
        title: `Title ${id}`,
        channel: "Channel",
        durationSec,
      })),
    },
  };
}

const ok = (id: string): VideoCheck => ({ id, ok: true, problems: [], title: "", channel: "", durationSec: 1 });
const bad = (id: string, ...problems: string[]): VideoCheck => ({
  id, ok: false, problems, title: "", channel: "", durationSec: 0,
});

const MIN = 60;

describe("buildReport", () => {
  it("reports no failures when every track passes", () => {
    const [r] = buildReport([game("a", [["aaaaaaaaaaa", 70 * MIN]])], [ok("aaaaaaaaaaa")]);
    expect(r.failed).toEqual([]);
    expect(r.playableSec).toBe(70 * MIN);
    expect(r.needsReplacement).toBe(false);
  });

  it("lists failed tracks with saved title and reasons, and drops them from playable length", () => {
    const [r] = buildReport(
      [game("a", [["aaaaaaaaaaa", 50 * MIN], ["bbbbbbbbbbb", 20 * MIN], ["ccccccccccc", 5 * MIN]])],
      [ok("aaaaaaaaaaa"), bad("bbbbbbbbbbb", "video not found"), ok("ccccccccccc")],
    );
    expect(r.failed).toEqual([{ id: "bbbbbbbbbbb", savedTitle: "Title bbbbbbbbbbb", problems: ["video not found"] }]);
    expect(r.totalSec).toBe(75 * MIN);
    expect(r.playableSec).toBe(55 * MIN);
    expect(r.needsReplacement).toBe(true);
  });

  it("doesn't flag a game that stays at 60+ minutes", () => {
    const [r] = buildReport(
      [game("a", [["aaaaaaaaaaa", 60 * MIN], ["bbbbbbbbbbb", 20 * MIN]])],
      [ok("aaaaaaaaaaa"), bad("bbbbbbbbbbb", "embedding disabled")],
    );
    expect(r.playableSec).toBe(60 * MIN);
    expect(r.needsReplacement).toBe(false);
  });

  it("reports a track shared by two games under both", () => {
    const reports = buildReport(
      [game("a", [["sssssssssss", 5 * MIN]]), game("b", [["sssssssssss", 5 * MIN]])],
      [bad("sssssssssss", "privacy is private")],
    );
    expect(reports.map((r) => r.failed.map((f) => f.id))).toEqual([["sssssssssss"], ["sssssssssss"]]);
  });
});

describe("formatReport", () => {
  it("says everything is playable when nothing failed", () => {
    const reports = buildReport([game("a", [["aaaaaaaaaaa", 70 * MIN]])], [ok("aaaaaaaaaaa")]);
    expect(formatReport(reports)).toBe("All 1 tracks in 1 game(s) are playable.");
  });

  it("groups failures by game and flags short games", () => {
    const reports = buildReport(
      [
        game("short", [["aaaaaaaaaaa", 50 * MIN], ["bbbbbbbbbbb", 20 * MIN]]),
        game("fine", [["ccccccccccc", 70 * MIN]]),
        game("long", [["ddddddddddd", 65 * MIN], ["eeeeeeeeeee", 5 * MIN]]),
      ],
      [ok("aaaaaaaaaaa"), bad("bbbbbbbbbbb", "video not found"), ok("ccccccccccc"), ok("ddddddddddd"),
        bad("eeeeeeeeeee", "embedding disabled", "blocked in US")],
    );
    expect(formatReport(reports)).toBe(
      [
        "SHORT (short)",
        '  bbbbbbbbbbb  "Title bbbbbbbbbbb"  ← video not found',
        "  Playable: 50:00 (was 1:10:00)",
        "  ⚠ Below 60 min, needs replacement tracks",
        "",
        "LONG (long)",
        '  eeeeeeeeeee  "Title eeeeeeeeeee"  ← embedding disabled; blocked in US',
        "  Playable: 1:05:00 (was 1:10:00)",
        "",
        "2 of 5 tracks failed across 2 of 3 game(s); 1 game(s) need replacement tracks.",
      ].join("\n"),
    );
  });
});
