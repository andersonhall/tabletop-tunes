import type { MusicSource, MusicSourceFactory } from "./MusicSource";

// Minimal typings for the parts of the YouTube IFrame Player API we use.
// https://developers.google.com/youtube/iframe_api_reference
interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
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
