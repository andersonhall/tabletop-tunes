# Backend: sign-in and saved user data

The site stays a static app on GitHub Pages. Sign-in and per-user saved data (playlist edits, hidden tracks) use **Firebase** on the free Spark plan: **Firebase Auth** (Google sign-in) and **Firestore**. The browser talks to Firebase directly. Nothing runs on a server of ours.

Signing in is optional. Anyone can search and play generated playlists without it, and the app works the same if Firebase is down or can't load.

## How the app uses it

- The UI only talks to the `Backend` / `UserDataStore` interface in [`src/backend/Backend.ts`](../src/backend/Backend.ts). [`firebaseBackend.ts`](../src/backend/firebaseBackend.ts) is the only Firebase-specific code, so a different backend can replace it without touching components.
- Firebase is loaded lazily in its own chunk ([`BackendProvider.tsx`](../src/backend/BackendProvider.tsx)), so search and playback never wait on it.
- **Saves never get queued and lost.** Offline persistence is off, and every read and write goes to the server, failing after 10 seconds with `BackendUnavailableError`. The UI must only show a change once its save has resolved.
- With the config in [`src/backend/firebaseConfig.ts`](../src/backend/firebaseConfig.ts) left empty, sign-in is hidden and the app runs as it did before the backend existed.

## Data model (Firestore)

```
writers/{uid}                  {}   allowlist of accounts that may save (created by hand)
users/{uid}                    { hiddenTracks: string[], autoPlay?: boolean, shuffle?: boolean, updatedAt }
users/{uid}/playlists/{slug}   { gameSlug, basedOn, tracks: Track[], updatedAt }
```

- **`writers/{uid}`**: an empty doc whose existence means "this account can save". Only the account itself can read it, and no one can write it from the app, so it's managed in the Firebase console. Keeping the allowlist here rather than in the rules keeps account ids out of the public repo.
- **`users/{uid}`**: the user's settings. `hiddenTracks` holds the tracks hidden from all their playlists, as `"<source>:<sourceId>"` keys, e.g. `"youtube:dQw4w9WgXcQ"`. `autoPlay` is the header's Auto-play toggle, absent until the user changes it (the default is on). Signed out, or with an account that can't save, the toggle is kept in this browser's localStorage (`tabletopTunes.autoPlay`) instead. Once an account that can save has its own value, that value wins. `shuffle` is the header's Shuffle toggle and works the same way (default off; localStorage key `tabletopTunes.shuffle`).
- **`users/{uid}/playlists/{slug}`**: the user's own copy of one game's playlist. It's created the first time they edit that game. Generated playlists stay static files in `data/games/` and act as a cookie cutter: a game without a copy shows the current generated playlist, minus hidden tracks. Once a copy exists, it's what the user gets, and later regenerations don't change it. `basedOn` records which generated playlist the copy started from (`<playlist id>@<createdAt>`). `tracks` uses the `Track` shape from [`src/data/schema.ts`](../src/data/schema.ts).

## Security rules

[`firestore.rules`](../firestore.rules) is the source of truth:

- `users/{uid}/**` can be read only by that user, and written only by that user **if** `writers/{uid}` exists.
- `writers/{uid}` can be read (`get`) only by that user. No client can write it.
- Everything else is denied.

**Opening sign-up later:** remove `&& isWriter(uid)` from the write rule and deploy the rules. Every signed-in user then gets their own data space.

### Testing the rules

`npm run test:rules` runs [`firestore.rules.test.ts`](../firestore.rules.test.ts) against the Firestore emulator, which needs **Java 21+**. On Windows: `winget install Microsoft.OpenJDK.21`, then open a new terminal. The first run downloads the emulator. It uses a `demo-` project id, so no login or real project is needed. CI runs the same tests in its `rules` job. `npm test` skips them, so building and deploying the site doesn't need Java.

### Deploying the rules

Rules deploy separately from the site: merging to `master` deploys only Pages. After a rules change is merged:

```
npx firebase login                      # once per machine
npx firebase deploy --only firestore:rules
```

## One-time setup

1. **Create the project.** At <https://console.firebase.google.com/>, *Add project*. Use any name (e.g. `tabletop-tunes`). Google Analytics isn't needed. New projects start on the free Spark plan. Don't upgrade.
2. **Enable Google sign-in.** *Build → Authentication → Get started → Sign-in method → Google → Enable*. Pick a support email and save.
3. **Authorize the site's domain.** *Authentication → Settings → Authorized domains → Add domain*: `andersonhall.github.io`. (`localhost` is already there for `npm run dev`.)
4. **Create Firestore.** *Build → Firestore Database → Create database*. Pick a location near you (e.g. `nam5`) and start in **production mode**, which denies everything until our rules are deployed.
5. **Register the web app.** *Project settings (gear) → General → Your apps → Web (`</>`)*. Give it a nickname, skip Hosting, and copy the `firebaseConfig` values into [`src/backend/firebaseConfig.ts`](../src/backend/firebaseConfig.ts). They're public identifiers, not secrets.
6. **Point the CLI at the project.** Put the project id in [`.firebaserc`](../.firebaserc), then deploy the rules (see [Deploying the rules](#deploying-the-rules)).
7. **Allowlist yourself.** Sign in on the site once. Then in *Authentication → Users*, copy your **User UID**. In *Firestore → Start collection*, create collection `writers` with document id = that UID and no fields. Reload the site. The header's "Editing isn't available for this account" note goes away.

## How editing uses it

The game page's editing controls ([`useGamePlaylist.ts`](../src/components/useGamePlaylist.ts), with the pure rules in [`src/data/curation.ts`](../src/data/curation.ts)) show only for an allowlisted, signed-in account.

- **Remove, reorder, add** save the whole visible list as the user's copy (`savePlaylist`). The first edit to a game creates the copy.
- **Hide everywhere** only updates `hiddenTracks`. Hidden tracks are filtered out whenever a playlist is displayed, so a hide covers every game, edited or not, without rewriting any copies. A copy is saved without hidden tracks, so un-hiding a track later (by pasting it in again) doesn't bring it back into other games' copies.
- **Reset to generated playlist** deletes the copy (`deletePlaylist`).
- **Undo** writes the previous state back: the previous copy (or deletes it, if the remove created it), or the previous hidden list.
- If the copy or hidden list can't be loaded, the page shows the generated playlist with editing off, so a fallback list can never overwrite a saved copy.

Adding a track tests the pasted video in a hidden, muted YouTube player (`youtubeTrackResolver` in [`youtubeSource.ts`](../src/music/youtubeSource.ts)). The title and length come from the player, so the browser needs no YouTube API key.

## Checking saved data by hand

Signed-in data can also be checked from the browser's devtools console:

```js
await tabletopTunes.userData.setHiddenTracks(["youtube:test-value"]);
await tabletopTunes.userData.getHiddenTracks();   // same result on any browser you're signed in on
await tabletopTunes.userData.setHiddenTracks([]); // clean up
```

A non-allowlisted account gets `NotAllowedError: Editing isn't available for this account.` on the write.
