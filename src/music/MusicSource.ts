// The music-source layer: everything the player needs from a playback
// backend. YouTube is the only implementation today; Apple Music or Spotify
// can be added later behind the same interface.

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

/** Creates a source that renders into `container` and reports through `events`. */
export type MusicSourceFactory = (
  container: HTMLElement,
  events: MusicSourceEvents,
) => Promise<MusicSource>;
