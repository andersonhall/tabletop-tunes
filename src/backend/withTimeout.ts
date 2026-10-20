import { BackendUnavailableError } from "./Backend";

/** How long a save or load may take before we report the server as unreachable. */
export const SERVER_TIMEOUT_MS = 10_000;

/**
 * Rejects with BackendUnavailableError if `promise` doesn't settle in time.
 * Firestore keeps retrying a write while offline instead of failing, so
 * without this a save would hang (and look like it worked).
 */
export function withTimeout<T>(promise: Promise<T>, ms = SERVER_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BackendUnavailableError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
