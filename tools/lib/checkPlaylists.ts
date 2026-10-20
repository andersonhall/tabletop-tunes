// Pure report logic for check-playlists: pairs saved tracks with fresh
// verification results so it can be unit-tested without the network.

import { MIN_PLAYLIST_SEC, totalDurationSec, type GameFile } from "../../src/data/schema";
import { formatDuration } from "../../src/format";
import type { VideoCheck } from "./youtubeParse";

export interface FailedTrack {
  id: string;
  /** Title as saved in the playlist file (the live one may be gone). */
  savedTitle: string;
  problems: string[];
}

export interface GameReport {
  name: string;
  slug: string;
  trackCount: number;
  failed: FailedTrack[];
  totalSec: number;
  /** Length of the playlist without the failed tracks. */
  playableSec: number;
  needsReplacement: boolean;
}

export function buildReport(files: readonly GameFile[], checks: readonly VideoCheck[]): GameReport[] {
  const byId = new Map(checks.map((c) => [c.id, c]));
  return files.map((file) => {
    const tracks = file.playlist.tracks;
    const failed: FailedTrack[] = [];
    let playableSec = 0;
    for (const t of tracks) {
      const check = byId.get(t.sourceId);
      if (check?.ok) {
        playableSec += t.durationSec;
      } else {
        failed.push({ id: t.sourceId, savedTitle: t.title, problems: check?.problems ?? ["not checked"] });
      }
    }
    return {
      name: file.game.name,
      slug: file.game.slug,
      trackCount: tracks.length,
      failed,
      totalSec: totalDurationSec(tracks),
      playableSec,
      needsReplacement: playableSec < MIN_PLAYLIST_SEC,
    };
  });
}

export function formatReport(reports: readonly GameReport[]): string {
  const trackCount = reports.reduce((n, r) => n + r.trackCount, 0);
  const broken = reports.filter((r) => r.failed.length > 0);
  if (broken.length === 0) {
    return `All ${trackCount} tracks in ${reports.length} game(s) are playable.`;
  }

  const lines: string[] = [];
  for (const r of broken) {
    lines.push(`${r.name} (${r.slug})`);
    for (const f of r.failed) lines.push(`  ${f.id}  "${f.savedTitle}"  ← ${f.problems.join("; ")}`);
    lines.push(`  Playable: ${formatDuration(r.playableSec)} (was ${formatDuration(r.totalSec)})`);
    if (r.needsReplacement) {
      lines.push(`  ⚠ Below ${MIN_PLAYLIST_SEC / 60} min, needs replacement tracks`);
    }
    lines.push("");
  }
  const failedCount = broken.reduce((n, r) => n + r.failed.length, 0);
  const flagged = broken.filter((r) => r.needsReplacement).length;
  lines.push(
    `${failedCount} of ${trackCount} tracks failed across ${broken.length} of ${reports.length} game(s)` +
      (flagged ? `; ${flagged} game(s) need replacement tracks.` : "."),
  );
  return lines.join("\n");
}
