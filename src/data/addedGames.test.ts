import { describe, expect, it } from "vitest";
import type { AddedGame } from "../backend/Backend";
import {
  ADDED_BY,
  findExisting,
  mergeCatalog,
  parseBggLink,
  pickSlug,
  toCatalogGame,
  validateGameForm,
  type CatalogGame,
} from "./addedGames";
import { SCHEMA_VERSION, type GameFile } from "./schema";

function generated(slug: string, name: string, year: number | null, bggId: number): GameFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    game: { slug, name, year, bggId },
    playlist: {
      id: `${slug}-default`,
      ownerId: "andy",
      generatedBy: "claude-code",
      createdAt: "2026-10-20",
      tracks: [{ source: "youtube", sourceId: "aaaaaaaaaaa", title: "A", channel: "C", durationSec: 3600 }],
    },
  };
}

const added = (slug: string, name: string, year: number | null = null, bggId: number | null = null): AddedGame => ({
  slug,
  name,
  year,
  bggId,
});

const cascadia = generated("cascadia", "Cascadia", 2021, 295947);

describe("parseBggLink", () => {
  it.each([
    ["https://boardgamegeek.com/boardgame/295947/cascadia", 295947],
    ["https://www.boardgamegeek.com/boardgame/295947", 295947],
    ["boardgamegeek.com/boardgame/295947/cascadia/files?x=1", 295947],
    ["https://boardgamegeek.com/boardgameexpansion/314343/cascadia-landmarks", 314343],
    ["  https://BoardGameGeek.com/boardgame/13/catan  ", 13],
  ])("reads the id from %s", (link, id) => {
    expect(parseBggLink(link)).toBe(id);
  });

  it.each([
    "295947",
    "https://boardgamegeek.com/geeklist/1234",
    "https://example.com/boardgame/13",
    "https://boardgamegeek.com/boardgame/0/x",
    "https://boardgamegeek.com/boardgame/abc",
  ])("rejects %s", (link) => {
    expect(parseBggLink(link)).toBeUndefined();
  });
});

describe("validateGameForm", () => {
  const form = (name: string, year = "", bggLink = "") => validateGameForm({ name, year, bggLink }, 2026);

  it("accepts a name alone", () => {
    expect(form("  Heat:  Pedal to the Metal ")).toEqual({
      ok: true,
      value: { name: "Heat: Pedal to the Metal", year: null, bggId: null },
    });
  });

  it("reads the year and BGG link", () => {
    expect(form("Cascadia", "2021", "https://boardgamegeek.com/boardgame/295947/cascadia")).toEqual({
      ok: true,
      value: { name: "Cascadia", year: 2021, bggId: 295947 },
    });
  });

  it("requires a name with a letter or number", () => {
    expect(form("   ").ok).toBe(false);
    expect(form("!!!").ok).toBe(false);
  });

  it.each(["21", "1799", "2028", "20x1"])("rejects the year %s", (year) => {
    expect(form("Cascadia", year).ok).toBe(false);
  });

  it("allows next year", () => {
    expect(form("Cascadia", "2027").ok).toBe(true);
  });

  it("rejects a link that isn't a BGG game link", () => {
    const result = form("Cascadia", "", "https://example.com");
    expect(result.ok).toBe(false);
  });
});

describe("findExisting", () => {
  const catalog: CatalogGame[] = [cascadia, toCatalogGame(added("finspan", "Finspan", 2024))];

  it("matches the same BGG id, even with a different name", () => {
    expect(findExisting(catalog, { name: "Cascadia (2nd ed.)", year: 2023, bggId: 295947 })).toBe(cascadia);
  });

  it("matches the same name and year", () => {
    expect(findExisting(catalog, { name: "cascadia!", year: 2021, bggId: null })?.game.slug).toBe("cascadia");
    expect(findExisting(catalog, { name: "Finspan", year: 2024, bggId: null })?.game.slug).toBe("finspan");
  });

  it("doesn't match a different year or BGG id", () => {
    expect(findExisting(catalog, { name: "Cascadia", year: 2030, bggId: null })).toBeUndefined();
    expect(findExisting(catalog, { name: "Cascadia", year: 2021, bggId: 1 })).toBeUndefined();
  });

  it("skips the game being edited", () => {
    expect(findExisting(catalog, { name: "Finspan", year: 2024, bggId: null }, "finspan")).toBeUndefined();
  });
});

describe("pickSlug", () => {
  const catalog: CatalogGame[] = [cascadia, toCatalogGame(added("cascadia-2030", "Cascadia", 2030))];

  it("uses the name when it's free", () => {
    expect(pickSlug(catalog, "Hadrian's Wall", 2021)).toBe("hadrians-wall");
  });

  it("adds the year, then a number, when the slug is taken", () => {
    expect(pickSlug(catalog, "Cascadia", 2031)).toBe("cascadia-2031");
    expect(pickSlug(catalog, "Cascadia", 2030)).toBe("cascadia-2030-2");
    expect(pickSlug(catalog, "Cascadia", null)).toBe("cascadia-2");
  });
});

describe("toCatalogGame", () => {
  it("has an empty website playlist", () => {
    const g = toCatalogGame(added("finspan", "Finspan", 2024));
    expect(g.playlist.tracks).toEqual([]);
    expect(g.playlist.generatedBy).toBe(ADDED_BY);
    expect(g.game).toEqual({ slug: "finspan", name: "Finspan", year: 2024, bggId: null });
  });
});

describe("mergeCatalog", () => {
  it("adds the user's games, sorted by name", () => {
    const merged = mergeCatalog([cascadia], [added("ark-nova", "Ark Nova", 2021)]);
    expect(merged.map((g) => g.game.slug)).toEqual(["ark-nova", "cascadia"]);
    expect(merged[0]!.added).toBeDefined();
    expect(merged[1]!.added).toBeUndefined();
  });

  it("drops an added game that a generated file now covers, keeping the same slug", () => {
    const merged = mergeCatalog([cascadia], [added("cascadia", "Cascadia", 2021)]);
    expect(merged).toEqual([cascadia]);
  });

  it("points the generated game at the added game's copy when the slugs differ", () => {
    const merged = mergeCatalog([cascadia], [added("cascadia-x", "Cascadia X", null, 295947)]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.game.slug).toBe("cascadia");
    expect(merged[0]!.copySlug).toBe("cascadia-x");
  });
});
