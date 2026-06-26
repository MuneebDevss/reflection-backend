import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuthService } from '../oauth.service';

/**
 * McpBearerGuard
 * ──────────────
 * Lives inside OAuthModule (not McpModule) and is exported from there.
 *
 * WHY IT MOVED HERE — the actual fix for UnknownDependenciesException:
 *   RekogMcpModule.forRoot({ guards: [McpBearerGuard] }) doesn't just add
 *   McpBearerGuard as a provider in *your* McpModule's own scope — the
 *   library's forRoot() builds its own dynamic module internally to host
 *   the /mcp route, and resolves the guard class within that module's
 *   provider graph. Declaring McpBearerGuard a second time in McpModule's
 *   own `providers: [...]` array does NOT make OAuthService visible to the
 *   FIRST instantiation that forRoot() already triggered — Nest does not
 *   retroactively merge sibling provider declarations across two separate
 *   registrations of the same class.
 *
 *   The fix is to make McpBearerGuard resolvable from a SINGLE module that
 *   already has OAuthService in its own providers — i.e. OAuthModule itself
 *   — and export it from there. Any consumer (forRoot()'s internal module,
 *   or anything else) that imports OAuthModule gets a guard instance that
 *   was constructed inside a graph where OAuthService was always available,
 *   regardless of import ordering elsewhere.
 *
 * Responsibilities (unchanged from before):
 *   1. Reject requests with no/garbage Authorization header → 401 +
 *      WWW-Authenticate, so Claude triggers OAuth discovery.
 *   2. Validate the bearer token (hashed lookup against oauth_access_tokens).
 *   3. Attach { userId, scopes } onto the request for tool handlers to read.
 */
@Injectable()
export class McpBearerGuard implements CanActivate {
  constructor(private readonly oauth: OAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
  const req = context.switchToHttp().getRequest();
  const res = context.switchToHttp().getResponse();
  const authHeader: string | undefined = req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${process.env.APP_URL}/.well-known/oauth-protected-resource"`
    );
    throw new UnauthorizedException('Unauthorized');
  }

    const token = authHeader.slice('Bearer '.length);
    const { userId, scopes } = await this.oauth.validateToken(token);

    req.mcpUserId = userId;
    req.mcpScopes = scopes;

    return true;
  }
}