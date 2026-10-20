// Every committed playlist file must be valid, so a bad file fails CI
// instead of silently disappearing from the app.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { slugify, validateGameFile, type GameFile } from "./schema";

const dir = new URL("../../data/games/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("data/games", () => {
  it.each(files)("%s is a valid playlist file", (name) => {
    const parsed: unknown = JSON.parse(readFileSync(new URL(name, dir), "utf8"));
    const result = validateGameFile(parsed);
    expect(result.ok ? [] : result.errors).toEqual([]);
    if (result.ok) expect(`${result.value.game.slug}.json`).toBe(name);
  });

  // Slugs deliberately shortened via a `slug` override in the draft.
  const slugOverrides = new Set(["seti", "lord-of-the-rings-fellowship-trick-taking-game"]);

  it.each(files)("%s slug matches slugify(name) unless overridden", (name) => {
    const file = JSON.parse(readFileSync(new URL(name, dir), "utf8")) as GameFile;
    if (slugOverrides.has(file.game.slug)) return;
    expect(file.game.slug).toBe(slugify(file.game.name));
  });

  it("has at least one playlist", () => {
    expect(files.length).toBeGreaterThan(0);
  });
});
