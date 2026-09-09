import type { Config } from "../config.js";
import { buildHttpAbp } from "./http.js";
import { buildMockAbp } from "./mock.js";
import type { AbpPort } from "./port.js";

/** Real ABP when configured, otherwise the deterministic mock. */
export function buildAbpPort(config: Config): AbpPort {
  return config.abpBaseUrl ? buildHttpAbp(config.abpBaseUrl) : buildMockAbp();
}