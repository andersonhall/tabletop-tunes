import { describe, expect, it } from "vitest";
import { APP_WINDOW_NAME, bookmarkletHref, bookmarkletSource } from "./bookmarklet";
import { parseImportQuery } from "./melodice";

const APP = "https://andersonhall.github.io/tabletop-tunes/";

/** Runs the bookmarklet against a minimal stand-in for a Melodice page. */
function run(page: { pathname: string; h1?: string; href?: string }) {
  const opened: [string, string][] = [];
  const alerts: string[] = [];
  const document = {
    querySelector: (sel: string) =>
      sel === "h1"
        ? page.h1 === undefined
          ? null
          : { textContent: page.h1 }
        : page.href === undefined
          ? null
          : { getAttribute: () => page.href },
  };
  const window = { open: (url: string, name: string) => void opened.push([url, name]) };
  new Function("document", "location", "window", "alert", bookmarkletSource(APP))(
    document,
    { pathname: page.pathname },
    window,
    (m: string) => void alerts.push(m),
  );
  return { opened, alerts };
}

describe("bookmarklet", () => {
  it("sends a Melodice page's game and list to the app's import route, in the app's tab", () => {
    const { opened } = run({
      pathname: "/playlist/agricola-2007/",
      h1: "  Agricola ",
      href: "/redirect/agricola-2007/http://www.youtube.com/watch_videos%3Fvideo_ids=pjXdDjUWkjk,T1x-WoLHK9k",
    });
    expect(opened).toHaveLength(1);
    const [url, name] = opened[0]!;
    expect(name).toBe(APP_WINDOW_NAME);
    expect(url.startsWith(`${APP}#/import?`)).toBe(true);
    expect(parseImportQuery(url.slice(url.indexOf("?")))).toEqual({
      name: "Agricola",
      melodiceSlug: "agricola-2007",
      ids: ["pjXdDjUWkjk", "T1x-WoLHK9k"],
    });
  });

  it("explains itself on a page without a list", () => {
    const { opened, alerts } = run({ pathname: "/about/" });
    expect(opened).toEqual([]);
    expect(alerts).toHaveLength(1);
  });

  it("is a javascript: URL", () => {
    expect(bookmarkletHref(APP).startsWith("javascript:")).toBe(true);
  });
});
