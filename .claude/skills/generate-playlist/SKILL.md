---
name: generate-playlist
description: Generate a thematic background-music playlist for a board game and save it into tabletop-tunes' data files. Use when Andy says things like "generate a playlist for <game>", "make a playlist for <game>", "add <game>", or "redo the <game> playlist".
---

# generate-playlist

Builds one game's playlist from its BoardGameGeek info, checks every track against the YouTube Data API, and saves it to `data/games/<slug>.json`. Background and setup are in `docs/generating-playlists.md`.

## Inputs

- `GAME`: the board game's name, as Andy said it.

## Steps

0. **Check existing playlists, once per session.** At the start of a playlist-generation session (not before every game in a batch), run `npm run check-playlists`. If it reports failed tracks, show Andy the report and add every listed game to this session's batch. For each one, replace the dead tracks with new picks (steps 3–6, starting from the saved track list minus the failures, re-saved with `--force`). For a game flagged as below 60 minutes, add tracks until it's back to 1–2 hours. A clean report (exit 0) means there's nothing to fix.

1. **Check setup.** `.env` must have `BGG_API_TOKEN` and `YOUTUBE_API_KEY`. The tools print a clear error if one is missing. If so, point Andy to the setup section of `docs/generating-playlists.md` and stop.

2. **Identify the game.** Run `npm run bgg -- search "<GAME>"`.
   - No matches: tell Andy and ask for a different spelling.
   - **More than one plausible match** (reimplementations, editions, same-name games, a big-box vs. base game): list the candidates with year and BGG id, and **ask Andy which one he means. Don't guess.** Only skip asking when exactly one result is clearly the game (e.g. a single exact-name match and the rest are obviously unrelated expansions/spin-offs).
   - If `data/games/<slug>.json` already exists for it, ask whether to replace it (that needs `--force` at step 6).

3. **Read the theme.** Run `npm run bgg -- thing <bggId>`. From the description, categories, mechanics, and families, work out the setting, era, and mood (e.g. "1960s Cold War tension, espionage, nuclear brinkmanship" or "serene Japanese garden").

4. **Pick tracks.** Aim for **roughly 70–110 minutes**. The saved total must fall between 60 and 120 minutes, and a margin covers tracks that fail verification.
   - **Lean heavily instrumental/ambient**: game soundtracks, film/TV scores, ambient mixes, period instrumentals. Background music shouldn't compete with table talk.
   - **Vocal tracks only where they really fit the theme**, and keep them the exception (e.g. 1940s big-band for Manhattan Project).
   - Prefer official/composer uploads and well-established channels over re-uploads, which get taken down more often.
   - Long single mixes (30–60 min) are fine, but mix in variety. A playlist of two one-hour videos is too monotonous.
   - Find candidates with `npm run yt -- search "<query>"`. **Each search costs 100 of the 10,000 daily quota units**, so use targeted queries and stop at around 10–15 searches.
   - Optionally check a shortlist with `npm run yt -- verify <id> …` (cheap: 1 unit per 50 ids).

5. **Write a draft** to the session scratchpad (not the repo):
   ```json
   { "bggId": <id>, "name": "<BGG primary name>", "year": <year>, "tracks": ["<videoId>", "..."] }
   ```
   Track order is play order. Open with something that sets the mood.

6. **Save.** `npm run save-playlist -- <draft path>` (add `--force` only if Andy agreed to replace an existing playlist). It re-verifies every track (exists, public, embeddable, playable in the US, fixed duration), drops failures and says why, and refuses to write unless the result is 1–2 hours. If it refuses, add or remove tracks and re-run.

7. **Check.** `npm test` must pass (it validates every saved file).

8. **Show Andy the result**: game, total length, and the track list (title, channel, length) with a one-line note on the mood you went for. Ask whether he wants changes.

9. **Publish, with Andy's go-ahead only.** Pushing to `master` deploys the site (`.github/workflows/deploy.yml`), so ask first, every time. On a yes: commit just the new or changed `data/games/<slug>.json` with a message like `Add playlist for <Game>`, push to `master`, and tell Andy it will show up at https://andersonhall.github.io/tabletop-tunes/ once the Deploy workflow finishes (`gh run watch` or the Actions tab).
   - If the current branch isn't `master` (e.g. mid-feature), say so and ask how to proceed instead of pushing.
