# tabletop-tunes

Background music for board game night. Each game gets an AI-generated thematic playlist (generated ahead of time with Claude Code, not crowd-curated), played through YouTube's embedded player in a desktop browser.

**Live:** https://andersonhall.github.io/tabletop-tunes/

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # unit tests + validates every playlist in data/games/
npm run typecheck
```

## Adding a playlist

Open Claude Code in this repo and ask it to generate a playlist for a game. See [docs/generating-playlists.md](docs/generating-playlists.md) for one-time API key setup and how it works.

## Layout

- `src/data/`: playlist file schema and the `PlaylistStore` (today it reads bundled JSON; it's swappable for a database later)
- `src/music/`: the music-source layer (`MusicSource` interface, with YouTube as the first implementation)
- `src/player/`: playback queue logic and the React hook that drives the source
- `src/components/`: search and game/player pages
- `tools/`: playlist-generation CLI (BoardGameGeek and YouTube Data API), kept separate from the app
- `data/games/`: saved playlists, one JSON file per game
