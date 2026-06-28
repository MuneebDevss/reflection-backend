import { AuthenticatedContext } from "../types";
import type { Request } from "express";
export function getUserId(ctx: AuthenticatedContext): string {
    const req = ( ctx.request) as Request & { mcpUserId?: string };

    if (!req.mcpUserId) {
      throw new Error('AUTH_EXPIRED');
    }
    return req.mcpUserId;
  }