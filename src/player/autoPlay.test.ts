import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldAutoStart, watchAutoStart, type AutoStartInputs } from "./autoPlay";

describe("shouldAutoStart", () => {
  const go: AutoStartInputs = {
    enabled: true,
    settingReady: true,
    playlistStatus: "ready",
    playerReady: true,
    trackCount: 3,
    attempted: false,
  };

  it("starts once everything is ready and auto-play is on", () => {
    expect(shouldAutoStart(go)).toBe(true);
  });

  it("starts the generated playlist when the user's copy couldn't load", () => {
    expect(shouldAutoStart({ ...go, playlistStatus: "loadFailed" })).toBe(true);
  });

  it.each<[string, Partial<AutoStartInputs>]>([
    ["auto-play is off", { enabled: false }],
    ["the setting hasn't been read yet", { settingReady: false }],
    ["the user's copy is still loading", { playlistStatus: "loading" }],
    ["the player isn't ready", { playerReady: false }],
    ["the playlist is empty", { trackCount: 0 }],
    ["it already tried on this page", { attempted: true }],
  ])("waits or skips when %s", (_, change) => {
    expect(shouldAutoStart({ ...go, ...change })).toBe(false);
  });
});

describe("watchAutoStart", () => {
  afterEach(() => vi.useRealTimers());

  it("reports blocked when playback doesn't start in time", () => {
    vi.useFakeTimers();
    const onBlocked = vi.fn();
    watchAutoStart(onBlocked, 1000);
    vi.advanceTimersByTime(999);
    expect(onBlocked).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onBlocked).toHaveBeenCalledOnce();
  });

  it("stays quiet once playback starts", () => {
    vi.useFakeTimers();
    const onBlocked = vi.fn();
    watchAutoStart(onBlocked, 1000).playing();
    vi.advanceTimersByTime(5000);
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it("stays quiet when cancelled", () => {
    vi.useFakeTimers();
    const onBlocked = vi.fn();
    watchAutoStart(onBlocked, 1000).cancel();
    vi.advanceTimersByTime(5000);
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
