import type { WorldSnapshot } from "../types.js";
import { JsonFileFeed } from "./jsonFeed.js";
import type { FeedSource } from "./types.js";

/**
 * Demo feed: replays a time-series of hand-written snapshots so the loop looks
 * alive without Member A running. Loops by default.
 */
export class ReplayFeed implements FeedSource {
  readonly label = "replay";
  readonly intervalMs: number;
  private readonly frames: WorldSnapshot[];
  private index = 0;

  constructor(frames: WorldSnapshot[], intervalMs: number, private readonly loop: boolean) {
    this.frames = frames;
    this.intervalMs = intervalMs;
  }

  static async fromFiles(
    filePaths: string[],
    intervalMs: number,
    loop = true,
  ): Promise<ReplayFeed> {
    const frames: WorldSnapshot[] = [];
    for (const filePath of filePaths) {
      try {
        const snapshot = await new JsonFileFeed(filePath).read();
        if (snapshot) frames.push(snapshot);
      } catch (error) {
        console.warn(`[feed] replay skipped ${filePath}: ${String(error)}`);
      }
    }
    return new ReplayFeed(frames, intervalMs, loop);
  }

  async read(): Promise<WorldSnapshot | null> {
    if (this.frames.length === 0) return null;
    if (!this.loop && this.index >= this.frames.length) return null;
    const frame = this.frames[this.index % this.frames.length]!;
    this.index += 1;
    return frame;
  }
}