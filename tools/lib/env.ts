import { existsSync } from "node:fs";

// Loads .env from the repo root (if present) so tools can read API keys.
if (existsSync(".env")) process.loadEnvFile(".env");

export function requireEnv(name: "BGG_API_TOKEN" | "YOUTUBE_API_KEY"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(
      `Missing ${name}. Copy .env.example to .env and fill it in ` +
        `(see docs/generating-playlists.md).`,
    );
    process.exit(1);
  }
  return value;
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
