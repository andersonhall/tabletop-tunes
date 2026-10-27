# Trying a game's Melodice list

When a game's playlist isn't working mid-game, you can play that game's [Melodice](https://melodice.org) list as a temporary **alternate**. Your own playlist stays as it is. A Melodice track only gets into your playlist when you **Keep** it, or when you choose **Replace mine with this**.

melodice.org doesn't let other sites read its pages, so the app can't fetch Melodice itself. A bookmarklet you click on the Melodice page sends the list to the app instead.

## Installing the bookmarklet

1. In Tabletop Tunes, click **Melodice bookmarklet** in the page footer (or go to `#/melodice`).
2. Drag the **Send to Tabletop Tunes** button to your browser's bookmarks bar. You only need to do this once per browser.

The bookmarklet points at the copy of the app you dragged it from: the live site, or `npm run dev` locally. Drag it again if that copy moves.

## Using it

1. On melodice.org, open the game's page (e.g. `melodice.org/playlist/agricola-2007/`).
2. Click **Send to Tabletop Tunes**.
   - **Which tab opens:** the bookmarklet tries to reuse a tab where the app is already open. Some browsers don't allow that, and a new tab opens instead. Close the old one so two players don't run at once.
   - **Matching the game:** the app matches Melodice's game on its name and year. If that isn't a single clear match, it asks you which game the list is for, or tells you the game isn't in the app yet.
3. The game page opens with the Melodice list playing.
   - **The Mine | Melodice toggle** switches which list plays.
   - **Close Melodice list** goes back to yours.

## What plays

- Up to Melodice's 50 tracks, in Melodice's ranked order. Your Shuffle setting applies.
- Tracks you've hidden everywhere are left out.
- Videos that can't play here (removed, private, or not embeddable) are skipped.
- Titles and lengths load in the background. Tracks still loading show as "Loading…" but can already play.

## Keeping tracks

You need to be signed in with an account that can save.

- **Keep** (next to the player, or on any Melodice track's row) adds that track to the end of your playlist for this game. It creates your own copy if this is your first edit. You can undo it.
- **Replace mine with this** makes your playlist exactly the Melodice list, minus hidden tracks, once every track has loaded. You can undo it.

## How long an alternate lasts

It's kept for the browser tab, separately for each game. It survives a reload or a trip back to search, and it's gone once you close the tab, or sooner if you press **Close Melodice list**.
