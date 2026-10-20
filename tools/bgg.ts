// BoardGameGeek lookups for playlist generation.
//
//   npm run bgg -- search "<game name>"   list matching games (to disambiguate)
//   npm run bgg -- thing <bggId>          theme info: description, categories, mechanics, families

import { fail } from "./lib/env";
import { bggSearch, bggThing } from "./lib/api";

const [command, ...rest] = process.argv.slice(2);
const arg = rest.join(" ").trim();

if (command === "search" && arg) {
  const results = await bggSearch(arg);
  if (results.length === 0) {
    console.log(`No BoardGameGeek matches for "${arg}".`);
  } else {
    // Exact-name matches first; BGG's own order is otherwise arbitrary.
    const q = arg.toLowerCase();
    results.sort((a, b) => Number(b.name.toLowerCase() === q) - Number(a.name.toLowerCase() === q));
    console.log(`${results.length} match(es) for "${arg}":`);
    for (const r of results.slice(0, 25)) {
      console.log(`  ${String(r.id).padStart(7)}  ${r.name}${r.year ? ` (${r.year})` : ""}  [${r.type}]`);
    }
    if (results.length > 25) console.log(`  … and ${results.length - 25} more; refine the name.`);
  }
} else if (command === "thing" && /^\d+$/.test(arg)) {
  const thing = await bggThing(Number(arg));
  if (!thing) fail(`No BoardGameGeek item with id ${arg}.`);
  console.log(JSON.stringify(thing, null, 2));
} else {
  fail('Usage: npm run bgg -- search "<game name>" | npm run bgg -- thing <bggId>');
}
