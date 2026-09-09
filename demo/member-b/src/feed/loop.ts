import type { WorldSnapshot } from "../types.js";
import type { FeedSource } from "./types.js";

export interface LoopHandlers {
  onSnapshot(snapshot: WorldSnapshot): Promise<void>;
  onError?(error: unknown): void;
}

/** Continuously pulls a feed source and hands snapshots to the pipeline. */
export async function runFeedLoop(
  source: FeedSource,
  handlers: LoopHandlers,
  signal?: AbortSignal,
): Promise<void> {
  while (!signal?.aborted) {
    try {
      const snapshot = await source.read();
      if (snapshot) {
        await handlers.onSnapshot(snapshot);
      }
    } catch (error) {
      handlers.onError?.(error);
    }
    await delay(source.intervalMs ?? 2000, signal);
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}