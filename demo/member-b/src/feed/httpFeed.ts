import type { WorldSnapshot } from "../types.js";
import { parseSnapshot } from "./snapshot.js";
import type { FeedSource } from "./types.js";

/** Polls Member A's live world-state feed (Day N-1 integration). */
export class HttpFeed implements FeedSource {
  readonly label: string;
  readonly intervalMs: number;

  constructor(
    private readonly url: string,
    pollMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.label = `http:${url}`;
    this.intervalMs = pollMs;
  }

  async read(): Promise<WorldSnapshot | null> {
    try {
      const response = await this.fetchImpl(this.url);
      if (!response.ok) return null;
      return parseSnapshot(await response.json());
    } catch (error) {
      console.warn(`[feed] poll ${this.url} failed: ${String(error)}`);
      return null;
    }
  }
}