import type { WorldSnapshot } from "../types.js";

export interface FeedSource {
  readonly label: string;
  /** How long the loop waits between reads. */
  readonly intervalMs?: number;
  read(): Promise<WorldSnapshot | null>;
}