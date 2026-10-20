import { describe, expect, it } from "vitest";
import { searchGames } from "./search";
import type { GameFile } from "./data/schema";

function game(name: string): GameFile {
  return {
    schemaVersion: 1,
    game: { bggId: 1, name, year: 2000, slug: name.toLowerCase().replace(/\W+/g, "-") },
    playlist: { id: "x", ownerId: "andy", generatedBy: "test", createdAt: "2026-01-01", tracks: [] },
  };
}

const games = [
  game("Terraforming Mars"),
  game("Mars Open: Tabletop Grand Prix"),
  game("Spirit Island"),
  game("Ark Nova"),
  game("Agrícola"),
];
const names = (q: string) => searchGames(games, q).map((g) => g.game.name);

describe("searchGames", () => {
  it("is case-insensitive", () => {
    expect(names("spirit ISLAND")).toEqual(["Spirit Island"]);
  });

  it("matches partial words in any order", () => {
    expect(names("mars terra")).toEqual(["Terraforming Mars"]);
  });

  it("ranks names that start with the query first", () => {
    expect(names("mars")).toEqual(["Mars Open: Tabletop Grand Prix", "Terraforming Mars"]);
  });

  it("ignores accents and punctuation", () => {
    expect(names("agricola")).toEqual(["Agrícola"]);
    expect(names("mars open tabletop")).toEqual(["Mars Open: Tabletop Grand Prix"]);
  });

  it("returns nothing for a game with no saved playlist", () => {
    expect(names("Brass: Birmingham")).toEqual([]);
  });

  it("returns nothing for a blank query", () => {
    expect(names("   ")).toEqual([]);
  });
});
