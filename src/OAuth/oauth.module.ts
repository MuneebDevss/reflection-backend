import { Global, Module } from '@nestjs/common'
import { OAuthController } from './oauth.controller'
import { OAuthService } from './oauth.service'
import { PrismaModule } from '../prisma/prisma.module'
import { McpBearerGuard } from './guards/mcp-bearer.guard'

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [OAuthController],
  exports: [OAuthService, McpBearerGuard],
  providers: [OAuthService, McpBearerGuard],
})
export class OAuthModule {}