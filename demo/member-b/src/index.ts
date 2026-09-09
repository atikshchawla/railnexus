/**
 * Member B service bootstrap: picks a feed source (live Member A HTTP feed, or
 * the demo replay from fixtures), runs the three departments on every snapshot,
 * and serves the state API the COA dashboard / proof page polls.
 */

import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildAbpPort } from "./abp/client.js";
import { loadConfig } from "./config.js";
import { corridorLabel, corridorSections } from "./corridor.js";
import { buildSmmsEngine } from "./departments/smms.js";
import { buildTdmsEngine } from "./departments/tdms.js";
import { buildTmsEngine } from "./departments/tms.js";
import { HttpFeed } from "./feed/httpFeed.js";
import { runFeedLoop } from "./feed/loop.js";
import { ReplayFeed } from "./feed/replayFeed.js";
import type { FeedSource } from "./feed/types.js";
import { buildPipeline } from "./pipeline.js";
import { buildApp } from "./server.js";
import { Store } from "./store.js";

const REPLAY_FRAME_COUNT = 4;
const REPLAY_TICK_MS = 1500;

async function resolveFeedSource(
  config: ReturnType<typeof loadConfig>,
): Promise<FeedSource | null> {
  if (config.feedMode === "manual") {
    return null;
  }
  if (config.memberAFeedUrl || config.feedMode === "http") {
    if (!config.memberAFeedUrl) {
      throw new Error("FEED_MODE=http requires MEMBER_A_FEED_URL");
    }
    return new HttpFeed(config.memberAFeedUrl, config.feedPollMs);
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixturesDir = path.resolve(here, "..", "fixtures", "world");
  const files = Array.from(
    { length: REPLAY_FRAME_COUNT },
    (_, index) => path.join(fixturesDir, `snapshot-${index + 1}.json`),
  );
  return ReplayFeed.fromFiles(files, REPLAY_TICK_MS);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const store = new Store(corridorLabel, corridorSections());
  const engines = [buildTmsEngine(), buildTdmsEngine(), buildSmmsEngine()];
  const abp = buildAbpPort(config);
  const pipeline = buildPipeline({ store, engines, abp });

  const source = await resolveFeedSource(config);
  const feedLabel = source?.label ?? "manual";
  store.setFeedSource(feedLabel);
  if (source) {
    void runFeedLoop(source, {
      onSnapshot: async (snapshot) => {
        await pipeline.process(snapshot);
      },
      onError: (error) => console.error("[feed] loop error:", error),
    });
  } else {
    console.log(
      "[member-b] feed=manual — posting to POST /api/ingest drives the demo",
    );
  }

  const app = buildApp({
    store,
    process: (snapshot) => pipeline.process(snapshot),
    inject: (input) => pipeline.inject(input),
  });
  const server = app.listen(config.port);
  await once(server, "listening");
  console.log(
    `[member-b] listening on http://localhost:${config.port} · feed=${feedLabel} · abp=${abp.name}`,
  );
}

main().catch((error) => {
  console.error("[member-b] fatal:", error);
  process.exit(1);
});