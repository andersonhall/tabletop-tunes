// Pure helpers for YouTube Data API v3 responses
// (https://developers.google.com/youtube/v3/docs/videos).

/** Country the game-room PC plays from; videos blocked here are rejected. */
export const PLAYBACK_REGION = "US";

export interface RawVideo {
  id: string;
  snippet?: { title?: string; channelTitle?: string; liveBroadcastContent?: string };
  contentDetails?: { duration?: string; regionRestriction?: { allowed?: string[]; blocked?: string[] } };
  status?: { privacyStatus?: string; embeddable?: boolean; uploadStatus?: string };
}

export interface VideoCheck {
  id: string;
  ok: boolean;
  /** Why it can't be used, when !ok. */
  problems: string[];
  title: string;
  channel: string;
  durationSec: number;
}

/** "PT1H2M3S" → 3723. Returns 0 for live/unknown ("P0D"). */
export function parseIsoDuration(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? "");
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

/** Decodes the HTML entities YouTube leaves in search-result titles. */
export function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Checks each requested id against a videos.list response. Ids missing from
 * the response don't exist (or are private/deleted).
 */
export function checkVideos(requestedIds: readonly string[], items: readonly RawVideo[]): VideoCheck[] {
  const byId = new Map(items.map((v) => [v.id, v]));
  return requestedIds.map((id) => {
    const v = byId.get(id);
    if (!v) return { id, ok: false, problems: ["video not found"], title: "", channel: "", durationSec: 0 };

    const problems: string[] = [];
    const durationSec = parseIsoDuration(v.contentDetails?.duration);
    if (v.status?.privacyStatus !== "public") problems.push(`privacy is ${v.status?.privacyStatus ?? "unknown"}`);
    if (v.status?.embeddable !== true) problems.push("embedding disabled");
    if (v.status?.uploadStatus && v.status.uploadStatus !== "processed") {
      problems.push(`upload status is ${v.status.uploadStatus}`);
    }
    if (v.snippet?.liveBroadcastContent && v.snippet.liveBroadcastContent !== "none") {
      problems.push(`is a ${v.snippet.liveBroadcastContent} broadcast`);
    }
    if (durationSec <= 0) problems.push("no fixed duration");
    const region = v.contentDetails?.regionRestriction;
    if (region?.blocked?.includes(PLAYBACK_REGION)) problems.push(`blocked in ${PLAYBACK_REGION}`);
    if (region?.allowed && !region.allowed.includes(PLAYBACK_REGION)) {
      problems.push(`not available in ${PLAYBACK_REGION}`);
    }

    return {
      id,
      ok: problems.length === 0,
      problems,
      title: decodeHtml(v.snippet?.title ?? ""),
      channel: decodeHtml(v.snippet?.channelTitle ?? ""),
      durationSec,
    };
  });
}

/** Pulls an 11-char video id out of a bare id or any common YouTube URL form. */
export function extractVideoId(input: string): string | undefined {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = /(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(s);
  return m?.[1];
}
