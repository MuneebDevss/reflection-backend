// src/mcp/mcp.module.ts
import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { McpBearerGuard } from '../oauth/guards/mcp-bearer.guard'
import { OAuthModule } from '../oauth/oauth.module'
// ... your existing tool providers

@Module({
  imports: [OAuthModule],
  providers: [
    { provide: APP_GUARD, useClass: McpBearerGuard },
    // TasksMcpTools, PlansMcpTools, etc.
  ],
})
export class McpModule {}