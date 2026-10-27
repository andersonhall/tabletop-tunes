import { describe, expect, it } from "vitest";
import type { GameFile } from "../data/schema";
import { importQuery, matchGame, parseImportQuery, parseVideoIds, slugYear } from "./melodice";

const A = "pjXdDjUWkjk";
const B = "T1x-WoLHK9k";
const C = "wDooqTIHiSU";

describe("parseVideoIds", () => {
  it("reads a watch_videos link", () => {
    expect(parseVideoIds(`https://www.youtube.com/watch_videos?video_ids=${A},${B},${C}`)).toEqual([A, B, C]);
  });

  it("reads Melodice's redirect link, with its query URL-encoded", () => {
    const link = `https://melodice.org/redirect/agricola-2007/http://www.youtube.com/watch_videos%3Fvideo_ids=${A},${B}`;
    expect(parseVideoIds(link)).toEqual([A, B]);
  });

  it("reads a fully encoded link", () => {
    expect(parseVideoIds(encodeURIComponent(`https://youtube.com/watch_videos?video_ids=${A},${B}&x=1`))).toEqual([A, B]);
  });

  it("drops invalid ids and duplicates, keeping order", () => {
    expect(parseVideoIds(`?video_ids=${B},nope,${A},${B}`)).toEqual([B, A]);
  });

  it("caps at 50", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `video${String(i).padStart(6, "0")}`);
    expect(parseVideoIds(`?video_ids=${ids.join(",")}`)).toEqual(ids.slice(0, 50));
  });

  it("returns nothing for other input", () => {
    expect(parseVideoIds("")).toEqual([]);
    expect(parseVideoIds(`https://www.youtube.com/watch?v=${A}`)).toEqual([]);
    expect(parseVideoIds("%E0%A4%A")).toEqual([]);
  });
});

describe("import query", () => {
  it("round-trips", () => {
    const sent = { name: "Hadrian's Wall & Co", melodiceSlug: "hadrians-wall-2021", ids: [A, B] };
    expect(parseImportQuery(`?${importQuery(sent)}`)).toEqual(sent);
  });

  it("tolerates missing params", () => {
    expect(parseImportQuery("")).toEqual({ name: "", melodiceSlug: "", ids: [] });
  });
});

function game(name: string, year: number | null, slug = name.toLowerCase().replace(/\W+/g, "-")): GameFile {
  return {
    schemaVersion: 1,
    game: { bggId: 1, name, year, slug },
    playlist: { id: "x", ownerId: "andy", generatedBy: "test", createdAt: "2026-01-01", tracks: [] },
  };
}

describe("matchGame", () => {
  const games = [
    game("Agricola", 2007),
    game("Arkham Horror", 2005),
    game("Arkham Horror", 2018, "arkham-horror-third-edition"),
    game("Carcassonne", 2000),
    game("Agricola: All Creatures Big and Small", 2012, "agricola-all-creatures"),
  ];
  const slugs = (m: ReturnType<typeof matchGame>) =>
    m.kind === "match" ? m.game.game.slug : m.candidates.map((g) => g.game.slug);

  it("matches on name + year", () => {
    expect(slugs(matchGame(games, { name: "Agricola", melodiceSlug: "agricola-2007" }))).toBe("agricola");
    expect(slugs(matchGame(games, { name: "Arkham Horror", melodiceSlug: "arkham-horror-2018" }))).toBe(
      "arkham-horror-third-edition",
    );
  });

  it("matches on slug + year even if the name differs", () => {
    expect(slugs(matchGame(games, { name: "Carcassonne (Base)", melodiceSlug: "carcassonne-2000" }))).toBe(
      "carcassonne",
    );
  });

  it("asks when the year doesn't match", () => {
    expect(slugs(matchGame(games, { name: "Agricola", melodiceSlug: "agricola-2016" }))).toEqual([
      "agricola",
      "agricola-all-creatures",
    ]);
  });

  it("asks with no candidates when nothing matches", () => {
    expect(slugs(matchGame(games, { name: "Gloomhaven", melodiceSlug: "gloomhaven-2017" }))).toEqual([]);
  });

  it("asks when the slug has no year", () => {
    expect(slugYear("arkham-horror")).toBeUndefined();
    expect(slugs(matchGame(games, { name: "Arkham Horror", melodiceSlug: "arkham-horror" }))).toEqual([
      "arkham-horror",
      "arkham-horror-third-edition",
    ]);
  });
});
