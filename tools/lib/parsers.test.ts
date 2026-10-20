import { describe, expect, it } from "vitest";
import { parseSearch, parseThing } from "./bggParse";
import { checkVideos, extractVideoId, parseIsoDuration, type RawVideo } from "./youtubeParse";
import { buildGameFile } from "./buildGameFile";

const SEARCH_XML = `<?xml version="1.0" encoding="utf-8"?>
<items total="2" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="13"><name type="primary" value="CATAN"/><yearpublished value="1995"/></item>
  <item type="boardgame" id="27710"><name type="primary" value="Catan Dice Game"/><yearpublished value="2007"/></item>
  <item type="boardgame" id="999"><name type="alternate" value="No Year Game"/></item>
</items>`;

const THING_XML = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="12333">
    <name type="primary" sortindex="1" value="Twilight Struggle"/>
    <name type="alternate" sortindex="1" value="Zimna Wojna"/>
    <description>&amp;quot;Now the trumpet summons us again&amp;quot;&amp;#10;&amp;#10;A Cold War game.</description>
    <yearpublished value="2005"/>
    <minplayers value="2"/><maxplayers value="2"/><playingtime value="180"/>
    <link type="boardgamecategory" id="1" value="Modern Warfare"/>
    <link type="boardgamecategory" id="2" value="Political"/>
    <link type="boardgamemechanic" id="3" value="Campaign / Battle Card Driven"/>
    <link type="boardgamefamily" id="4" value="Theme: Cold War"/>
    <link type="boardgamedesigner" id="5" value="Ananda Gupta"/>
  </item>
</items>`;

describe("BGG parsers", () => {
  it("parses search results, including missing years and non-primary names", () => {
    expect(parseSearch(SEARCH_XML)).toEqual([
      { id: 13, type: "boardgame", name: "CATAN", year: 1995 },
      { id: 27710, type: "boardgame", name: "Catan Dice Game", year: 2007 },
      { id: 999, type: "boardgame", name: "No Year Game", year: null },
    ]);
  });

  it("parses an empty search", () => {
    expect(parseSearch(`<items total="0"></items>`)).toEqual([]);
  });

  it("parses a thing's theme info and decodes the description", () => {
    const t = parseThing(THING_XML)!;
    expect(t.name).toBe("Twilight Struggle");
    expect(t.alternateNames).toEqual(["Zimna Wojna"]);
    expect(t.year).toBe(2005);
    expect(t.description).toBe('"Now the trumpet summons us again"\n\nA Cold War game.');
    expect(t.categories).toEqual(["Modern Warfare", "Political"]);
    expect(t.mechanics).toEqual(["Campaign / Battle Card Driven"]);
    expect(t.families).toEqual(["Theme: Cold War"]);
    expect(t.playingTimeMin).toBe(180);
  });

  it("returns undefined for an unknown thing", () => {
    expect(parseThing(`<items></items>`)).toBeUndefined();
  });
});

const video = (id: string, overrides: Partial<RawVideo> = {}): RawVideo => ({
  id,
  snippet: { title: "Ambient &amp; Calm", channelTitle: "Chan", liveBroadcastContent: "none" },
  contentDetails: { duration: "PT1H2M3S" },
  status: { privacyStatus: "public", embeddable: true, uploadStatus: "processed" },
  ...overrides,
});

describe("YouTube parsers", () => {
  it("parses ISO 8601 durations", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT10M")).toBe(600);
    expect(parseIsoDuration("P1DT1S")).toBe(86401);
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration(undefined)).toBe(0);
  });

  it("accepts a public, embeddable, processed video", () => {
    const [c] = checkVideos(["aaaaaaaaaaa"], [video("aaaaaaaaaaa")]);
    expect(c).toEqual({
      id: "aaaaaaaaaaa",
      ok: true,
      problems: [],
      title: "Ambient & Calm",
      channel: "Chan",
      durationSec: 3723,
    });
  });

  it("rejects missing, non-embeddable, private, live, and region-blocked videos", () => {
    const checks = checkVideos(
      ["missing0000", "noembed0000", "private0000", "live0000000", "blocked0000", "allowed0000"],
      [
        video("noembed0000", { status: { privacyStatus: "public", embeddable: false } }),
        video("private0000", { status: { privacyStatus: "unlisted", embeddable: true } }),
        video("live0000000", {
          snippet: { title: "Live", liveBroadcastContent: "live" },
          contentDetails: { duration: "P0D" },
        }),
        video("blocked0000", { contentDetails: { duration: "PT5M", regionRestriction: { blocked: ["DE", "US"] } } }),
        video("allowed0000", { contentDetails: { duration: "PT5M", regionRestriction: { allowed: ["JP"] } } }),
      ],
    );
    expect(checks.map((c) => c.ok)).toEqual([false, false, false, false, false, false]);
    expect(checks[0].problems).toEqual(["video not found"]);
    expect(checks[1].problems).toEqual(["embedding disabled"]);
    expect(checks[2].problems).toEqual(["privacy is unlisted"]);
    expect(checks[3].problems).toContain("no fixed duration");
    expect(checks[4].problems).toEqual(["blocked in US"]);
    expect(checks[5].problems).toEqual(["not available in US"]);
  });

  it("extracts video ids from ids and URLs", () => {
    expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("not a video")).toBeUndefined();
  });
});

describe("buildGameFile", () => {
  const draft = { bggId: 13, name: "Catan", year: 1995, tracks: [] };
  const ok = (id: string, durationSec: number) => ({ id, ok: true, problems: [], title: id, channel: "c", durationSec });

  it("drops failed and duplicate tracks and validates the result", () => {
    const { file, validation } = buildGameFile(
      draft,
      [ok("a", 2400), { ...ok("b", 9999), ok: false, problems: ["embedding disabled"] }, ok("a", 2400), ok("c", 2400)],
      "2026-10-19",
    );
    expect(file.playlist.tracks.map((t) => t.sourceId)).toEqual(["a", "c"]);
    expect(file.game.slug).toBe("catan");
    expect(file.playlist.ownerId).toBe("andy");
    expect(validation.ok).toBe(true);
  });

  it("fails validation when what's left is under an hour", () => {
    const { validation } = buildGameFile(draft, [ok("a", 600)], "2026-10-19");
    expect(validation.ok).toBe(false);
  });
});
