// Thin network wrappers for the BGG and YouTube APIs. All parsing lives in
// bggParse.ts / youtubeParse.ts so it can be unit-tested without the network.

import { requireEnv, fail } from "./env";
import { parseSearch, parseThing, type BggSearchResult, type BggThing } from "./bggParse";
import { checkVideos, type RawVideo, type VideoCheck } from "./youtubeParse";

const BGG = "https://boardgamegeek.com/xmlapi2";
const YT = "https://www.googleapis.com/youtube/v3";

async function bggGet(path: string): Promise<string> {
  const token = requireEnv("BGG_API_TOKEN");
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BGG}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    // 202 = request queued, 429 = rate limited: back off and retry.
    if (res.status === 202 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (res.status === 401) fail("BGG rejected the token (401). Check BGG_API_TOKEN in .env.");
    if (!res.ok) fail(`BGG request failed: ${res.status} ${res.statusText}`);
    return res.text();
  }
  fail("BGG kept asking us to retry; try again in a minute.");
}

export async function bggSearch(query: string): Promise<BggSearchResult[]> {
  return parseSearch(await bggGet(`/search?type=boardgame&query=${encodeURIComponent(query)}`));
}

export async function bggThing(id: number): Promise<BggThing | undefined> {
  return parseThing(await bggGet(`/thing?id=${id}`));
}

async function ytGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = requireEnv("YOUTUBE_API_KEY");
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${YT}${path}?${qs}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    fail(`YouTube API ${path} failed: ${res.status} ${body.error?.message ?? res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Checks up to any number of ids (batched 50 per request, 1 quota unit each). */
export async function ytVerify(ids: readonly string[]): Promise<VideoCheck[]> {
  const results: VideoCheck[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await ytGet<{ items?: RawVideo[] }>("/videos", {
      part: "snippet,contentDetails,status",
      id: batch.join(","),
      maxResults: "50",
    });
    results.push(...checkVideos(batch, data.items ?? []));
  }
  return results;
}

/** Search (100 quota units), then verify the hits so results include duration and status. */
export async function ytSearch(query: string, max = 10): Promise<VideoCheck[]> {
  const data = await ytGet<{ items?: { id?: { videoId?: string } }[] }>("/search", {
    part: "id",
    type: "video",
    videoEmbeddable: "true",
    maxResults: String(max),
    q: query,
  });
  const ids = (data.items ?? []).map((i) => i.id?.videoId).filter((id): id is string => !!id);
  return ids.length ? ytVerify(ids) : [];
}
