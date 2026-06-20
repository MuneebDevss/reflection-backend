import {
  CanActivate, ExecutionContext, Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { OAuthService } from '../oauth.service'

@Injectable()
export class McpBearerGuard implements CanActivate {
  constructor(private oauth: OAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const auth: string | undefined = req.headers['authorization']

    if (!auth?.startsWith('Bearer ')) {
      // Return 401 with WWW-Authenticate so Claude triggers discovery
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Unauthorized',
        // This header is what tells Claude to start the OAuth flow
        wwwAuthenticate: `Bearer resource_metadata="${process.env.APP_URL}/.well-known/oauth-protected-resource"`,
      })
    }

    const token = auth.slice(7)
    const { userId, scopes } = await this.oauth.validateToken(token)
    req.mcpUserId = userId
    req.mcpScopes = scopes
    return true
  }
}
