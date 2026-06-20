import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { generateToken, sha256 } from './utils/tokens'
import { verifyPkce } from './utils/pkce'
import { addSeconds, addDays, isBefore } from 'date-fns'

@Injectable()
export class OAuthService {
  constructor(private prisma: PrismaService) {}

  // ── Dynamic Client Registration (RFC 7591) ──────────────────────────────

  async registerClient(body: {
    client_name?: string
    redirect_uris: string[]
    grant_types?: string[]
    scope?: string
  }) {
    const clientId = generateToken(16)
    // Public client — no secret needed when PKCE is enforced
    await this.prisma.oAuthClient.create({
      data: {
        clientId,
        clientName: body.client_name ?? 'Unknown client',
        redirectUris: body.redirect_uris,
        grantTypes: body.grant_types ?? ['authorization_code', 'refresh_token'],
        scopes: body.scope ? body.scope.split(' ') : ['tasks:read', 'tasks:write'],
      },
    })
    return {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris,
      grant_types: body.grant_types ?? ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none', // public client
    }
  }

  // ── Authorization code creation (called after user approves consent) ────

  async createAuthCode(params: {
    clientId: string
    userId: string
    redirectUri: string
    scopes: string[]
    codeChallenge: string
  }) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId: params.clientId },
    })
    if (!client) throw new BadRequestException('Unknown client')
    if (!client.redirectUris.includes(params.redirectUri))
      throw new BadRequestException('redirect_uri mismatch')

    const code = generateToken(32)
    await this.prisma.oAuthAuthCode.create({
      data: {
        code,
        clientId: params.clientId,
        userId: params.userId,
        redirectUri: params.redirectUri,
        scopes: params.scopes,
        codeChallenge: params.codeChallenge,
        expiresAt: addSeconds(new Date(), 600), // 10 min
      },
    })
    return code
  }

  // ── Token exchange ───────────────────────────────────────────────────────

  async exchangeCode(body: {
    grant_type: string
    code?: string
    redirect_uri?: string
    code_verifier?: string
    client_id?: string
    refresh_token?: string
  }) {
    if (body.grant_type === 'authorization_code') {
      return this.exchangeAuthCode(body)
    }
    if (body.grant_type === 'refresh_token') {
      return this.exchangeRefreshToken(body.refresh_token!)
    }
    throw new BadRequestException('unsupported_grant_type')
  }

  private async exchangeAuthCode(body: {
  code?: string
  redirect_uri?: string
  code_verifier?: string
  client_id?: string
}) {
  if (!body.code || !body.code_verifier || !body.redirect_uri || !body.client_id) {
    throw new BadRequestException('invalid_request'); // Standard OAuth error string
  }

  try {
    // Consume code atomically up front to neutralize replay attacks
    const record = await this.prisma.oAuthAuthCode.update({
      where: { 
        code: body.code,
        used: false 
      },
      data: { used: true },
    });

    // Check expiration window
    if (isBefore(record.expiresAt, new Date())) {
      throw new UnauthorizedException('invalid_grant');
    }

    // Verify context match properties
    if (record.clientId !== body.client_id || record.redirectUri !== body.redirect_uri) {
      throw new UnauthorizedException('invalid_grant');
    }

    // Evaluate PKCE signature challenge
    if (!verifyPkce(body.code_verifier, record.codeChallenge)) {
      throw new UnauthorizedException('invalid_grant');
    }

    return this.issueTokens(record.clientId, record.userId, record.scopes);

  } catch (error) {
    // Catch Prisma record update failures gracefully
    throw new UnauthorizedException('invalid_grant');
  }
}

  private async exchangeRefreshToken(refreshToken: string) {
    const hash = sha256(refreshToken)
    const record = await this.prisma.oAuthAccessToken.findUnique({
      where: { refreshHash: hash },
    })

    if (!record || !record.refreshExpiresAt || isBefore(record.refreshExpiresAt, new Date())) {
      throw new UnauthorizedException('invalid_grant')
    }

    // Rotate: delete old, issue new
    await this.prisma.oAuthAccessToken.delete({ where: { id: record.id } })
    return this.issueTokens(record.clientId, record.userId, record.scopes)
  }

  private async issueTokens(clientId: string, userId: string, scopes: string[]) {
    const accessToken = generateToken(40)
    const refreshToken = generateToken(40)

    await this.prisma.oAuthAccessToken.create({
      data: {
        tokenHash: sha256(accessToken),
        refreshHash: sha256(refreshToken),
        clientId,
        userId,
        scopes,
        expiresAt: addSeconds(new Date(), 3600),        // 1 hour
        refreshExpiresAt: addDays(new Date(), 30),      // 30 days
      },
    })

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    }
  }

  // ── Token validation (used by McpBearerGuard) ────────────────────────────

  async validateToken(bearerToken: string): Promise<{ userId: string; scopes: string[] }> {
    const hash = sha256(bearerToken)
    const record = await this.prisma.oAuthAccessToken.findUnique({
      where: { tokenHash: hash },
    })

    if (!record || isBefore(record.expiresAt, new Date())) {
      throw new UnauthorizedException('invalid_token')
    }

    return { userId: record.userId, scopes: record.scopes }
  }
}
