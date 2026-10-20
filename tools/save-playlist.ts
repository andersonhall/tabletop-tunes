// Turns a draft into a saved playlist file at data/games/<slug>.json.
//
//   npm run save-playlist -- <draft.json> [--force]
//
// Draft format (keep drafts outside the repo, e.g. in a scratch folder):
//   { "bggId": 13, "name": "Catan", "year": 1995, "tracks": ["<videoId or URL>", ...] }
//
// Every track is re-verified against the YouTube Data API; failures are
// dropped and reported. The result must run 1–2 hours or nothing is written.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fail } from "./lib/env";
import { ytVerify } from "./lib/api";
import { extractVideoId } from "./lib/youtubeParse";
import { buildGameFile, type Draft } from "./lib/buildGameFile";
import { totalDurationSec } from "../src/data/schema";
import { formatDuration } from "../src/format";

const args = process.argv.slice(2);
const force = args.includes("--force");
const draftPath = args.find((a) => !a.startsWith("--")) ?? fail("Usage: npm run save-playlist -- <draft.json> [--force]");

let draft: Draft;
try {
  draft = JSON.parse(readFileSync(draftPath, "utf8")) as Draft;
} catch (e) {
  fail(`Couldn't read draft ${draftPath}: ${(e as Error).message}`);
}
if (!Array.isArray(draft.tracks) || draft.tracks.length === 0) fail("Draft has no tracks.");

const ids = draft.tracks.map((t) => extractVideoId(t) ?? fail(`Not a YouTube video id or URL: ${t}`));
const checks = await ytVerify(ids);

const dropped = checks.filter((c) => !c.ok);
for (const c of dropped) console.log(`Dropped ${c.id}: ${c.problems.join("; ")}`);

const today = new Date().toISOString().slice(0, 10);
const { file, validation } = buildGameFile(draft, checks, today);

const kept = file.playlist.tracks;
console.log(`${kept.length} track(s) kept, ${formatDuration(totalDurationSec(kept))} total.`);

if (!validation.ok) {
  fail(`Not saved:\n  - ${validation.errors.join("\n  - ")}`);
}

const out = `data/games/${file.game.slug}.json`;
if (existsSync(out) && !force) fail(`${out} already exists. Re-run with --force to replace it.`);
mkdirSync("data/games", { recursive: true });
writeFileSync(out, JSON.stringify(file, null, 2) + "\n");
console.log(`Saved ${out}`);
