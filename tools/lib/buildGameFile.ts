import {
  SCHEMA_VERSION,
  slugify,
  validateGameFile,
  type GameFile,
  type ValidationResult,
} from "../../src/data/schema";
import type { VideoCheck } from "./youtubeParse";

export interface Draft {
  bggId: number;
  name: string;
  year?: number | null;
  /** Optional override; defaults to slugify(name). */
  slug?: string;
  ownerId?: string;
  /** YouTube video ids or URLs, in play order. */
  tracks: string[];
}

/** Builds the saved file from a draft plus verification results (failed tracks dropped). */
export function buildGameFile(
  draft: Draft,
  checks: readonly VideoCheck[],
  today: string,
): { file: GameFile; validation: ValidationResult } {
  const slug = draft.slug ?? slugify(draft.name);
  const seen = new Set<string>();
  const tracks = checks
    .filter((c) => c.ok && !seen.has(c.id) && seen.add(c.id))
    .map((c) => ({
      source: "youtube" as const,
      sourceId: c.id,
      title: c.title,
      channel: c.channel,
      durationSec: c.durationSec,
    }));

  const file: GameFile = {
    schemaVersion: SCHEMA_VERSION,
    game: { bggId: draft.bggId, name: draft.name, year: draft.year ?? null, slug },
    playlist: {
      id: `${slug}-default`,
      ownerId: draft.ownerId ?? "andy",
      generatedBy: "claude-code",
      createdAt: today,
      tracks,
    },
  };
  return { file, validation: validateGameFile(file) };
}
