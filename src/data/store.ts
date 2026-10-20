import { createStaticPlaylistStore } from "./playlistStore";

// Every data/games/*.json file is bundled into the app at build time, so a
// new playlist appears once it's committed and the site redeploys.
const files = import.meta.glob("../../data/games/*.json", {
  eager: true,
  import: "default",
});

export const playlistStore = createStaticPlaylistStore(files);
