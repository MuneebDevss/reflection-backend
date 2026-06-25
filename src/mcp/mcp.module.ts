import { Module } from '@nestjs/common';
import { McpModule as RekogMcpModule, McpTransportType } from '@rekog/mcp-nest';
import { OAuthModule } from '../oauth/oauth.module';
import { TasksMcpTools } from './tools/tasks.mcp-tools';
import { PlansMcpTools } from './tools/plans.mcp-tools';
import { ScheduleMcpTools } from './tools/schedule.mcp-tools';
import { TasksModule } from '../tasks/tasks.module';
import { PlansModule } from '../plans/plans.module';
import { McpBearerGuard } from '../oauth/guards/mcp-bearer.guard'; // moved — see OAuthModule
/**
 * McpModule
 * ─────────
 * Mounts the MCP server *inside* this same NestJS process, on /mcp.
 *
 * Why no separate service/deployment (per spec Section 10):
 *   Tool providers below (TasksMcpTools, PlansMcpTools, ScheduleMcpTools)
 *   inject TasksService / PlansService directly — the exact same services
 *   the REST controllers use. There's no internal HTTP hop, no duplicated
 *   Prisma queries, and no second deployable artifact to operate.
 *
 * Transport: Streamable HTTP only.
 *   The library defaults to [SSE, STREAMABLE_HTTP, STDIO] all at once.
 *   We restrict to STREAMABLE_HTTP because:
 *     - SSE is the legacy MCP transport; Claude's custom connectors use
 *       Streamable HTTP exclusively going into 2026.
 *     - STDIO is for local-process MCP servers (e.g. Claude Desktop spawning
 *       a binary) — irrelevant for a hosted, multi-tenant web server.
 *   This collapses the exposed surface to a single endpoint: POST/GET/DELETE /mcp.
 *
 * Stateless mode: true (default).
 *   Each MCP request is a fresh Bearer-authenticated call — we don't need
 *   server-side session affinity. This also makes the module trivially
 *   horizontally-scalable later (no sticky sessions required), even though
 *   V1 ships as a single instance.
 *
 * Guard: McpBearerGuard runs on every request to /mcp, before any tool
 *   handler executes. There is no per-tool auth wiring needed — it's applied
 *   once, here, at the transport level.
 */
@Module({
  imports: [
    OAuthModule, // exports OAuthService, used by McpBearerGuard
    TasksModule, // exports TasksService, injected into TasksMcpTools
    PlansModule, // exports PlansService, injected into PlansMcpTools

    RekogMcpModule.forRootAsync({
      imports: [OAuthModule],
      useFactory: () => ({
        name: 'stratostodo-mcp',
        version: '1.0.0',
        instructions:
          'StratosToDo task manager. Use get_user_schedule before bulk_create_tasks ' +
          'to understand existing commitments and free capacity. All tools are scoped ' +
          'to the authenticated user automatically — never ask the user for their user ID.',
        
        transport: McpTransportType.STREAMABLE_HTTP,
        mcpEndpoint: 'mcp',
        
        streamableHttp: {
          enableJsonResponse: true,
          statelessMode: true,
        },
        
        guards: [McpBearerGuard],
      }),
    }),
  ],
  providers: [
    
    TasksMcpTools,
    PlansMcpTools,
    ScheduleMcpTools,
  ],
})
export class McpModule {}
  