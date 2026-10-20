# Generating playlists

Playlists are generated ahead of time in Claude Code (under Andy's subscription, with no paid API), then saved as JSON files in [`data/games/`](../data/games/). The web app only plays what's been saved. Pushing a new file to `master` redeploys the site, and the game then appears in the app.

The short version: open Claude Code in this repo and say **"generate a playlist for _<game>_"**. The project skill [`.claude/skills/generate-playlist`](../.claude/skills/generate-playlist/SKILL.md) holds the full procedure. This document covers setup and what happens at each step.

## One-time setup

1. `npm install`
2. Copy `.env.example` to `.env` (it's gitignored) and fill in:
   - **`BGG_API_TOKEN`**: BoardGameGeek requires a registered app token for its XML API. Register one at <https://boardgamegeek.com/using_the_xml_api> (non-commercial).
   - **`YOUTUBE_API_KEY`**: a free YouTube Data API v3 key:
     1. Go to <https://console.cloud.google.com/>, create (or pick) a project.
     2. *APIs & Services → Library*, search for **YouTube Data API v3**, and click **Enable**.
     3. *APIs & Services → Credentials → Create credentials → API key*.
     4. Optionally click *Edit API key* and restrict it to the YouTube Data API v3.
     The free quota is 10,000 units/day. A search costs 100 units and a verify costs 1 unit per 50 videos, so one playlist usually takes well under 2,000.

The keys only ever live in `.env` on your machine. The web app doesn't use them.

## The workflow

| Step | Command | Notes |
|---|---|---|
| 0. Check saved playlists | `npm run check-playlists` | Once at the start of a session. Lists dead tracks so they get fixed in the same batch. See [below](#checking-saved-playlists). |
| 1. Find the game | `npm run bgg -- search "<name>"` | If there's more than one plausible match, Claude asks which one you mean before going further. |
| 2. Read its theme | `npm run bgg -- thing <bggId>` | Description, categories, mechanics, families (e.g. "Theme: Cold War"). |
| 3. Find tracks | `npm run yt -- search "<query>"` | Leans heavily instrumental/ambient. Vocal tracks only when they really fit the theme (e.g. 1940s music for Manhattan Project). Long mixes and soundtracks work well. |
| 4. Check candidates | `npm run yt -- verify <id> …` | Confirms each video exists, is public, allows embedding, and isn't blocked in the US. |
| 5. Save | `npm run save-playlist -- <draft.json>` | Re-verifies, drops failures, requires 1–2 hours total, and writes `data/games/<slug>.json`. Add `--force` to replace an existing playlist. |
| 6. Check | `npm test` | Validates every saved file. |
| 7. Publish | commit + push to `master` | **This deploys.** Claude asks before pushing. The game appears in the app a minute or two after the Deploy workflow finishes. |

A draft (step 5) is a scratch file, not committed:

```json
{ "bggId": 12333, "name": "Twilight Struggle", "year": 2005,
  "tracks": ["<videoId or YouTube URL>", "..."] }
```

## Checking saved playlists

Videos can be taken down, made private, or have embedding turned off after a playlist is saved. To find those tracks:

```
npm run check-playlists                    # every game in data/games/
npm run check-playlists -- cascadia seti   # just these slugs
```

It re-verifies every saved track with the same checks as `save-playlist` (exists, public, embeddable, playable in the US, fixed duration). For each game with failures, it prints the failed tracks (id, saved title, and reason) and the playlist's length without them. A game that drops below 60 minutes is flagged as needing replacement tracks. It costs 1 quota unit per 50 tracks, so checking everything takes only a few units.

It exits with code 1 if any track fails, and 0 if everything plays. It only reports and never changes data files. To fix a game, regenerate or edit it through the generate-playlist skill and re-save with `--force`.

## Changing a playlist

For now, edit the game's file under `data/games/` by hand, or regenerate it with `--force`. The app picks up whatever is on `master`. In-app editing is a later story.
