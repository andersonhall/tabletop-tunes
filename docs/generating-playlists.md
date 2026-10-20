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

## Changing a playlist

For now, edit the game's file under `data/games/` by hand, or regenerate it with `--force`. The app picks up whatever is on `master`. In-app editing is a later story.
