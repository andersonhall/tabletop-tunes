// The "Send to Tabletop Tunes" bookmarklet. Run on a Melodice game page, it
// reads the page's "Listen on YouTube" link, the game's name (the h1), and
// Melodice's slug ("agricola-2007", which carries the year), then opens the
// app's #/import route with them.
//
// The script is plain ES5-ish source (not a compiled function) so what runs on
// Melodice is exactly what's tested. It targets the window name the app gives
// itself (APP_WINDOW_NAME), so an already-open app tab is reused where the
// browser allows it, rather than a second player starting.

export const APP_WINDOW_NAME = "tabletop-tunes";

/** The bookmarklet's script body, for an app at `appUrl` (e.g. "https://…/tabletop-tunes/"). */
export function bookmarkletSource(appUrl: string): string {
  return `(function(){
var a=document.querySelector('a[href*="watch_videos"]');
var m=/\\/playlist\\/([^/]+)/.exec(location.pathname);
if(!a||!m){alert("Tabletop Tunes: open a Melodice game page that has a Listen on YouTube link.");return;}
var h=document.querySelector("h1");
var q="name="+encodeURIComponent(h?h.textContent.trim():"")+"&slug="+encodeURIComponent(m[1])+"&ids=";
var ids=/video_ids=([^&#]+)/.exec(decodeURIComponent(a.getAttribute("href")));
window.open(${JSON.stringify(appUrl)}+"#/import?"+q+encodeURIComponent(ids?ids[1]:""),${JSON.stringify(APP_WINDOW_NAME)});
})();`;
}

export function bookmarkletHref(appUrl: string): string {
  return `javascript:${encodeURIComponent(bookmarkletSource(appUrl))}`;
}
