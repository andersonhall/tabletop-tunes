import { BackendUnavailableError, NotAllowedError } from "./Backend";

/**
 * Maps a Firebase SDK error (which carries a string `code`) onto the
 * backend layer's errors, so the UI never needs to know about Firebase.
 */
export function toBackendError(e: unknown): Error {
  if (e instanceof BackendUnavailableError || e instanceof NotAllowedError) return e;
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "permission-denied") return new NotAllowedError();
  if (code === "unavailable" || code === "deadline-exceeded" || code === "auth/network-request-failed") {
    return new BackendUnavailableError();
  }
  return e instanceof Error ? e : new Error(String(e));
}
