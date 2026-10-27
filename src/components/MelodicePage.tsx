import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { bookmarkletHref } from "../melodice/bookmarklet";
import { Layout } from "./Layout";

/** One-time setup for the "Send to Tabletop Tunes" bookmarklet. */
export function MelodicePage() {
  const bookmarklet = useRef<HTMLAnchorElement>(null);

  // Set directly: React won't render a javascript: href.
  useEffect(() => {
    const appUrl = new URL(import.meta.env.BASE_URL, location.origin).href;
    bookmarklet.current?.setAttribute("href", bookmarkletHref(appUrl));
  }, []);

  return (
    <Layout>
      <Link to="/" className="text-sm text-stone-400 hover:text-stone-200">
        ← All games
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Melodice bookmarklet</h1>
      <p className="mt-2 max-w-prose text-stone-400">
        When a game's playlist isn't working, send that game's Melodice list here to play instead. Your own playlist
        stays as it is, and you can keep the tracks you like.
      </p>
      <p className="mt-6">
        <a
          ref={bookmarklet}
          onClick={(e) => e.preventDefault()}
          title="Drag to your bookmarks bar"
          className="inline-block cursor-grab rounded-full border border-amber-500/60 px-4 py-1.5 font-medium text-amber-400 hover:border-amber-400 hover:text-amber-300"
        >
          Send to Tabletop Tunes
        </a>
      </p>
      <ol className="mt-6 max-w-prose list-decimal space-y-1 pl-5 text-sm text-stone-400">
        <li>Drag the button above to your browser's bookmarks bar. You only need to do this once per browser.</li>
        <li>On melodice.org, open a game's page.</li>
        <li>Click the bookmark. The game opens here with its Melodice list playing.</li>
      </ol>
    </Layout>
  );
}
