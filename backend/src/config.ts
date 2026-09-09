/** Runtime configuration from environment variables. */

export type FeedMode = "replay" | "http" | "manual";

export interface Config {
  port: number;
  feedMode: FeedMode;
  feedPollMs: number;
  fixturesDir: string;
  abpBaseUrl?: string;
  memberAFeedUrl?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config: Config = {
    port: numberOr(env.PORT, 8787),
    feedMode: feedModeValue(env.FEED_MODE, "replay"),
    feedPollMs: numberOr(env.FEED_POLL_MS, 2000),
    fixturesDir: env.FIXTURES_DIR?.trim() || "fixtures",
  };
  const abpBaseUrl = env.ABP_BASE_URL?.trim();
  if (abpBaseUrl) {
    config.abpBaseUrl = abpBaseUrl;
  }
  const memberAFeedUrl = env.MEMBER_A_FEED_URL?.trim();
  if (memberAFeedUrl) {
    config.memberAFeedUrl = memberAFeedUrl;
  }
  return config;
}

function numberOr(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function feedModeValue(raw: string | undefined, fallback: FeedMode): FeedMode {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim().toLowerCase();
  return trimmed === "replay" || trimmed === "http" || trimmed === "manual"
    ? trimmed
    : fallback;
}