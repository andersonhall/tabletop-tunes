// Re-verifies saved playlists against YouTube and reports tracks that no
// longer play. Read-only: fixes go through the generate-playlist skill.
//
//   npm run check-playlists [-- <slug> ...]
//
// Uses the same checks as save-playlist (1 quota unit per 50 tracks).
// Exits non-zero if any track fails.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fail } from "./lib/env";
import { ytVerify } from "./lib/api";
import { buildReport, formatReport } from "./lib/checkPlaylists";
import type { GameFile } from "../src/data/schema";

const DIR = "data/games";
const slugs = process.argv.slice(2);

const names = slugs.length
  ? slugs.map((s) => {
      const name = `${s}.json`;
      if (!existsSync(`${DIR}/${name}`)) fail(`No saved playlist for "${s}" (looked for ${DIR}/${name}).`);
      return name;
    })
  : readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

const files = names.map((n) => JSON.parse(readFileSync(`${DIR}/${n}`, "utf8")) as GameFile);
const ids = [...new Set(files.flatMap((f) => f.playlist.tracks.map((t) => t.sourceId)))];

const reports = buildReport(files, ids.length ? await ytVerify(ids) : []);
console.log(formatReport(reports));
if (reports.some((r) => r.failed.length > 0)) process.exitCode = 1;
