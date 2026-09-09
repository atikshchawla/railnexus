import type { Request, SectionState, AbpDecisionValue } from "../types.js";

export interface AbpContext {
  sectionState(sectionId: string): SectionState;
}

export interface AbpReply {
  decision: AbpDecisionValue;
  grantedWindow?: { startMin: number; endMin: number };
}

export interface AbpPort {
  readonly name: string;
  decide(request: Request, ctx: AbpContext): Promise<AbpReply>;
}