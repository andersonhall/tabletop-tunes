import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-8">
        <Link to="/" className="text-2xl font-semibold tracking-tight text-amber-400 hover:text-amber-300">
          Tabletop Tunes
        </Link>
        <p className="text-sm text-stone-400">Background music for game night.</p>
      </header>
      <main>{children}</main>
    </div>
  );
}

/** Shown when a search or link points at a game with no saved playlist. */
export function NoPlaylist({ name }: { name: string }) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900 p-5">
      <p className="font-medium">
        No playlist for “{name}” yet.
      </p>
      <p className="mt-1 text-sm text-stone-400">
        Playlists are generated ahead of time. Open Claude Code in the tabletop-tunes repo and ask it to
        generate a playlist for this game (see <code className="text-stone-300">docs/generating-playlists.md</code>).
      </p>
    </div>
  );
}
