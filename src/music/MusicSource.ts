// The music-source layer: everything the player needs from a playback
// backend. YouTube is the only implementation today; Apple Music or Spotify
// can be added later behind the same interface.

import type { Track } from "../data/schema";

export interface MusicSourceEvents {
  /** The current track finished playing. */
  onEnded(): void;
  /** The current track can't be played (removed, private, embedding blocked…). */
  onUnavailable(reason: string): void;
  /** Playing/paused state changed (including via the source's own controls). */
  onPlayingChange(playing: boolean): void;
}

export interface MusicSource {
  /** Loads a track by its source-specific id and starts playing it. */
  play(sourceId: string): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

/** Which track, without its details: enough to spot duplicates and hidden tracks. */
export type TrackRef = Pick<Track, "source" | "sourceId">;

export type ResolveResult = { ok: true; track: Track } | { ok: false; reason: string };

/** Turns what a user pasted (a URL or id) into a playable track. */
export interface TrackResolver {
  /** Recognizes the pasted text, without any network calls. Undefined if it isn't one of ours. */
  identify(input: string): TrackRef | undefined;
  /**
   * Tests that the source can actually play it, and fetches its title and
   * length. `reason` is plain language, for the UI.
   */
  resolve(ref: TrackRef): Promise<ResolveResult>;
}

/** Creates a source that renders into `container` and reports through `events`. */
export type MusicSourceFactory = (
  container: HTMLElement,
  events: MusicSourceEvents,
) => Promise<MusicSource>;
