// Every committed playlist file must be valid, so a bad file fails CI
// instead of silently disappearing from the app.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateGameFile } from "./schema";

const dir = new URL("../../data/games/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("data/games", () => {
  it.each(files)("%s is a valid playlist file", (name) => {
    const parsed: unknown = JSON.parse(readFileSync(new URL(name, dir), "utf8"));
    const result = validateGameFile(parsed);
    expect(result.ok ? [] : result.errors).toEqual([]);
    if (result.ok) expect(`${result.value.game.slug}.json`).toBe(name);
  });

  it("has at least one playlist", () => {
    expect(files.length).toBeGreaterThan(0);
  });
});
