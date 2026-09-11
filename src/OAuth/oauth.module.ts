import { Global, Module } from '@nestjs/common'
import { OAuthController } from './oauth.controller'
import { OAuthService } from './oauth.service'
import { PrismaModule } from '../prisma/prisma.module'
import { McpBearerGuard } from './guards/mcp-bearer.guard'
import { AuthModule } from '../auth/auth.module'      // ← add
@Global()
@Module({
  imports: [PrismaModule,AuthModule],
  controllers: [OAuthController],
  exports: [OAuthService, McpBearerGuard],
  providers: [OAuthService, McpBearerGuard],
})
export class OAuthModule {}