// Auto-play: starting a game's playlist as soon as its page opens. The
// decisions live here, free of React and YouTube, so they can be unit-tested.

/** How long an auto-start may take to report "playing" before we call it blocked. */
export const AUTO_START_GRACE_MS = 5_000;

export interface AutoStartInputs {
  enabled: boolean;
  /** The setting has been read (from the account, or this browser). */
  settingReady: boolean;
  /** "loading": the signed-in user's copy isn't in yet, so the track list may still change. */
  playlistStatus: "loading" | "ready" | "loadFailed";
  playerReady: boolean;
  trackCount: number;
  /** Auto-start runs at most once per game page. */
  attempted: boolean;
}

export function shouldAutoStart(i: AutoStartInputs): boolean {
  return (
    i.enabled &&
    i.settingReady &&
    i.playlistStatus !== "loading" &&
    i.playerReady &&
    i.trackCount > 0 &&
    !i.attempted
  );
}

export interface AutoStartWatch {
  /** Playback started: the auto-start worked. */
  playing(): void;
  cancel(): void;
}

/**
 * Browsers block audio until the page has been clicked, and YouTube's player
 * just never starts when that happens. So: if nothing is playing within the
 * grace period, report it as blocked.
 */
export function watchAutoStart(onBlocked: () => void, ms = AUTO_START_GRACE_MS): AutoStartWatch {
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timer = undefined;
    onBlocked();
  }, ms);
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  return { playing: cancel, cancel };
}
