import type { Request } from 'express';
import { McpContext } from '@rekog/mcp-nest';
export interface AuthenticatedContext extends McpContext {
  request: Request & { mcpUserId?: string, scopes?: any };
}
