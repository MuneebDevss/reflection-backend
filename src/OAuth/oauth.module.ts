import { Module } from '@nestjs/common'
import { OAuthController } from './oauth.controller'
import { OAuthService } from './oauth.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [OAuthController],
  exports: [OAuthService],
  providers: [OAuthService],
})
export class OAuthModule {}