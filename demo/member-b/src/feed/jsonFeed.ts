import { readFile } from "node:fs/promises";
import type { WorldSnapshot } from "../types.js";
import { parseSnapshot } from "./snapshot.js";
import type { FeedSource } from "./types.js";

/** Reads one hand-written snapshot file per call — the standalone path. */
export class JsonFileFeed implements FeedSource {
  readonly label: string;

  constructor(private readonly filePath: string) {
    this.label = `json:${filePath}`;
  }

  async read(): Promise<WorldSnapshot | null> {
    const content = await readFile(this.filePath, "utf8");
    return parseSnapshot(JSON.parse(content));
  }
}