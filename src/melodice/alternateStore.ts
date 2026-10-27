// A game's Melodice alternate lives in sessionStorage: it survives a reload or
// a trip back to search in the same tab, and is gone once the tab closes.

import { trackKey } from "../backend/Backend";
import type { Track } from "../data/schema";

/** What probing an id found: the track, or why it can't play. */
export type Resolved = Track | { failed: string };

export interface Alternate {
  /** Melodice's ranked order. */
  ids: string[];
  resolved: Record<string, Resolved>;
  /** Which list is selected: the alternate, or the user's own. */
  active: boolean;
  /** Just loaded: the game page should start it playing once. */
  fresh?: boolean;
}

/** The parts of Storage used here, so tests can pass a fake. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const key = (slug: string) => `tt.alternate.${slug}`;

/** Falls back to memory when storage is blocked or throws. */
export function createAlternateStore(getStorage: () => KeyValueStorage | undefined) {
  const memory = new Map<string, Alternate>();
  const storage = () => {
    try {
      return getStorage();
    } catch {
      return undefined;
    }
  };
  return {
    get(slug: string): Alternate | undefined {
      try {
        const raw = storage()?.getItem(key(slug));
        if (raw) return JSON.parse(raw) as Alternate;
      } catch {
        // Fall through to memory.
      }
      return memory.get(slug);
    },
    set(slug: string, alt: Alternate) {
      memory.set(slug, alt);
      try {
        storage()?.setItem(key(slug), JSON.stringify(alt));
      } catch {
        // Memory still has it, for this visit.
      }
    },
    remove(slug: string) {
      memory.delete(slug);
      try {
        storage()?.removeItem(key(slug));
      } catch {
        // Nothing to do.
      }
    },
  };
}

export const alternateStore = createAlternateStore(() =>
  typeof sessionStorage === "undefined" ? undefined : sessionStorage,
);

export function newAlternate(ids: string[], fresh = true): Alternate {
  return { ids, resolved: {}, active: true, fresh };
}

/** Title shown for an id whose details haven't come back yet. */
export const PLACEHOLDER_TITLE = "Loading…";

/**
 * What the alternate plays: Melodice's order, minus tracks hidden everywhere
 * and ids that can't play. Ids still being probed are placeholders, so
 * playback can start straight away.
 */
export function alternateTracks(alt: Alternate, hidden: ReadonlySet<string>): Track[] {
  const out: Track[] = [];
  for (const id of alt.ids) {
    const r = alt.resolved[id];
    if (r && "failed" in r) continue;
    const track: Track = r ?? { source: "youtube", sourceId: id, title: PLACEHOLDER_TITLE, channel: "", durationSec: 0 };
    if (!hidden.has(trackKey(track))) out.push(track);
  }
  return out;
}

export function pendingIds(alt: Alternate): string[] {
  return alt.ids.filter((id) => !alt.resolved[id]);
}
