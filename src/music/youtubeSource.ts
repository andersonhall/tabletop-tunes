import type { MusicSource, MusicSourceFactory, ResolveResult, TrackResolver } from "./MusicSource";

// Minimal typings for the parts of the YouTube IFrame Player API we use.
// https://developers.google.com/youtube/iframe_api_reference
interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  getDuration(): number;
  /** Undocumented but long-standing; title/author of the loaded video. */
  getVideoData(): { title?: string; author?: string };
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      height?: string;
      width?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const STATE_ENDED = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Pulls the video id out of what a user pasted: a bare id, or a youtube.com /
 * youtu.be / music.youtube.com link (watch, shorts, embed, live). Extra
 * parameters like a start time or playlist are ignored. Undefined if it isn't one.
 */
export function parseYouTubeInput(input: string): string | undefined {
  const text = input.trim();
  if (VIDEO_ID_RE.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  let id: string | null | undefined;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1];
  } else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    const [first, second] = url.pathname.split("/").filter(Boolean);
    if (first === "watch") id = url.searchParams.get("v");
    else if (first && ["shorts", "embed", "live", "v"].includes(first)) id = second;
  }
  return id && VIDEO_ID_RE.test(id) ? id : undefined;
}

/** YouTube onError codes, all of which mean "this video can't play here". */
export function describeYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return "invalid video id";
    case 5:
      return "video can't be played in the HTML5 player";
    case 100:
      return "video was removed or is private";
    case 101:
    case 150:
      return "video owner doesn't allow embedding";
    default:
      return `YouTube error ${code}`;
  }
}

let apiPromise: Promise<YTNamespace> | undefined;

function loadIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      apiPromise = undefined;
      reject(new Error("Couldn't load the YouTube player. Check the internet connection."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export const createYouTubeSource: MusicSourceFactory = async (container, events) => {
  const YT = await loadIframeApi();
  // YT.Player replaces the element it's given, so give it a child to replace.
  const mount = document.createElement("div");
  container.appendChild(mount);

  return new Promise<MusicSource>((resolve) => {
    const player = new YT.Player(mount, {
      height: "100%",
      width: "100%",
      playerVars: { playsinline: 1, rel: 0 },
      events: {
        onReady: () =>
          resolve({
            play: (id) => player.loadVideoById(id),
            pause: () => player.pauseVideo(),
            resume: () => player.playVideo(),
            destroy: () => player.destroy(),
          }),
        onStateChange: (e) => {
          if (e.data === STATE_ENDED) events.onEnded();
          else if (e.data === STATE_PLAYING) events.onPlayingChange(true);
          else if (e.data === STATE_PAUSED) events.onPlayingChange(false);
        },
        onError: (e) => events.onUnavailable(describeYouTubeError(e.data)),
      },
    });
  });
};

/** How long to wait for YouTube to start a pasted video before giving up. */
const RESOLVE_TIMEOUT_MS = 15_000;

export const youtubeTrackResolver: TrackResolver = {
  identify(input) {
    const sourceId = parseYouTubeInput(input);
    return sourceId ? { source: "youtube", sourceId } : undefined;
  },
  resolve: (ref) => probeVideo(ref.sourceId),
};

/**
 * Tests a video in a hidden, muted player: if it starts playing, it's playable
 * here, and its title and length come from the player. No YouTube API key
 * needed in the browser.
 */
async function probeVideo(id: string): Promise<ResolveResult> {
  let YT: YTNamespace;
  try {
    YT = await loadIframeApi();
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }

  const host = document.createElement("div");
  // Off-screen rather than display:none, which can stop the player loading.
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:400px;height:300px;";
  const mount = document.createElement("div");
  host.appendChild(mount);
  document.body.appendChild(host);

  return new Promise((resolve) => {
    let done = false;
    let player: YTPlayer | undefined;
    const finish = (result: ResolveResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        player?.destroy();
      } catch {
        // Already gone.
      }
      host.remove();
      resolve(result);
    };
    const timer = setTimeout(
      () => finish({ ok: false, reason: "YouTube didn't respond. Try again in a moment." }),
      RESOLVE_TIMEOUT_MS,
    );

    player = new YT.Player(mount, {
      height: "100%",
      width: "100%",
      playerVars: { playsinline: 1, rel: 0, mute: 1 },
      events: {
        onReady: () => {
          player!.mute();
          player!.loadVideoById(id);
        },
        onStateChange: (e) => {
          if (e.data !== STATE_PLAYING) return;
          const durationSec = Math.round(player!.getDuration());
          if (durationSec <= 0) {
            return finish({ ok: false, reason: "Live streams can't be added." });
          }
          const data = player!.getVideoData();
          finish({
            ok: true,
            track: {
              source: "youtube",
              sourceId: id,
              title: data.title?.trim() || id,
              channel: data.author?.trim() ?? "",
              durationSec,
            },
          });
        },
        onError: (e) => finish({ ok: false, reason: `It can't be played here: ${describeYouTubeError(e.data)}.` }),
      },
    });
  });
}
