import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendUnavailableError, NotAllowedError, trackKey } from "./Backend";
import { toBackendError } from "./firebaseErrors";
import { withTimeout } from "./withTimeout";

describe("withTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("passes through a result that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it("passes through an error that arrives in time", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 1000)).rejects.toThrow("boom");
  });

  it("reports the server as unreachable when nothing comes back", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 1000);
    const assertion = expect(pending).rejects.toBeInstanceOf(BackendUnavailableError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});

describe("toBackendError", () => {
  it("maps a rules rejection to NotAllowedError", () => {
    expect(toBackendError({ code: "permission-denied" })).toBeInstanceOf(NotAllowedError);
  });

  it.each(["unavailable", "deadline-exceeded", "auth/network-request-failed"])(
    "maps %s to BackendUnavailableError",
    (code) => {
      expect(toBackendError({ code })).toBeInstanceOf(BackendUnavailableError);
    },
  );

  it("keeps our own errors and wraps anything else", () => {
    const ours = new BackendUnavailableError();
    expect(toBackendError(ours)).toBe(ours);
    expect(toBackendError("weird").message).toBe("weird");
  });
});

describe("trackKey", () => {
  it("identifies a track by source and id", () => {
    expect(trackKey({ source: "youtube", sourceId: "abcdefghijk" })).toBe("youtube:abcdefghijk");
  });
});
