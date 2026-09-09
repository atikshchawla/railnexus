/**
 * HTTP client for the real ABP. Posts requests in the common request schema
 * to {baseUrl}/requests and parses the AbpReply. Transport failures degrade
 * to the deterministic mock decision so the demo loop never halts.
 */

import { abpReplySchema } from "../types.js";
import type { Request } from "../types.js";
import type { AbpPort, AbpReply } from "./port.js";

export function buildHttpAbp(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): AbpPort {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/requests`;
  return {
    name: `http:${endpoint}`,
    decide: async (request: Request): Promise<AbpReply> => {
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ request }),
        });
        if (!response.ok) {
          const degraded: AbpReply = { decision: "approved" };
          return degraded;
        }
        const parsed = abpReplySchema.parse(await response.json());
        const reply: AbpReply = { decision: parsed.decision };
        if (parsed.grantedWindow) {
          reply.grantedWindow = parsed.grantedWindow;
        }
        return reply;
      } catch (error) {
        console.warn(`[abp] request ${request.id} fell back to mock: ${String(error)}`);
        const fallback: AbpReply = { decision: "approved" };
        return fallback;
      }
    },
  };
}