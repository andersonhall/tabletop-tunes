// YouTube lookups for playlist generation.
//
//   npm run yt -- search "<query>"        find candidate videos (costs 100 of 10,000 daily quota units)
//   npm run yt -- verify <id|url> ...     check videos exist, are public, embeddable, and playable in the US

import { fail } from "./lib/env";
import { ytSearch, ytVerify } from "./lib/api";
import { extractVideoId, type VideoCheck } from "./lib/youtubeParse";
import { formatDuration } from "../src/format";

function print(checks: VideoCheck[]) {
  for (const c of checks) {
    const status = c.ok ? "OK  " : "FAIL";
    const detail = c.ok ? "" : `  ← ${c.problems.join("; ")}`;
    console.log(
      `${status} ${c.id}  ${formatDuration(c.durationSec).padStart(8)}  ${c.title}` +
        `${c.channel ? `  —  ${c.channel}` : ""}${detail}`,
    );
  }
}

const [command, ...rest] = process.argv.slice(2);

if (command === "search" && rest.length) {
  const query = rest.join(" ");
  const results = await ytSearch(query);
  if (results.length === 0) console.log(`No embeddable videos found for "${query}".`);
  print(results);
} else if (command === "verify" && rest.length) {
  const ids = rest.map((r) => extractVideoId(r) ?? fail(`Not a YouTube video id or URL: ${r}`));
  const results = await ytVerify(ids);
  print(results);
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - bad}/${results.length} usable.`);
} else {
  fail('Usage: npm run yt -- search "<query>" | npm run yt -- verify <id|url> ...');
}
