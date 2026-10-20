import { describe, expect, it } from "vitest";
import { slugify, validateGameFile, type Track } from "./schema";

const track = (id: string, durationSec: number): Track => ({
  source: "youtube",
  sourceId: id,
  title: `Track ${id}`,
  channel: "Some Channel",
  durationSec,
});

function file(tracks: Track[]) {
  return {
    schemaVersion: 1,
    game: { bggId: 13, name: "Catan", year: 1995, slug: "catan" },
    playlist: { id: "catan-default", ownerId: "andy", generatedBy: "claude-code", createdAt: "2026-10-19", tracks },
  };
}

describe("validateGameFile", () => {
  it("accepts a well-formed 1–2 hour playlist", () => {
    expect(validateGameFile(file([track("a", 3000), track("b", 2400)])).ok).toBe(true);
  });

  it("rejects a playlist shorter than an hour", () => {
    const r = validateGameFile(file([track("a", 1800)]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/30 min/);
  });

  it("rejects a playlist longer than two hours", () => {
    expect(validateGameFile(file([track("a", 7300)])).ok).toBe(false);
  });

  it("rejects duplicate tracks", () => {
    const r = validateGameFile(file([track("a", 2000), track("a", 2000)]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/duplicate/);
  });

  it("rejects an empty playlist", () => {
    expect(validateGameFile(file([])).ok).toBe(false);
  });

  it("reports structural problems", () => {
    const r = validateGameFile({ schemaVersion: 1, game: { name: "" }, playlist: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContain("game.bggId must be a positive integer");
      expect(r.errors).toContain("playlist.tracks must be a non-empty array");
    }
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Brass: Birmingham")).toBe("brass-birmingham");
    expect(slugify("Agrícola")).toBe("agricola");
    expect(slugify("Robinson Crusoe & Friends")).toBe("robinson-crusoe-and-friends");
  });
});
