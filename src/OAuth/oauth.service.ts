import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { generateToken, sha256 } from './utils/tokens'
import { verifyPkce } from './utils/pkce'
import {
  isClientIdUrl,
  fetchClientMetadataDocument,
  ResolvedClient,
} from './utils/oauth-client-metadata.util'
import { addSeconds, addDays, isBefore } from 'date-fns'

@Injectable()
export class OAuthService {
  constructor(private prisma: PrismaService) {}

  private readonly logger = new Logger(OAuthService.name)

  // In-memory CIMD cache. Fine for a single instance; move to Redis if you
  // scale horizontally, since each instance would otherwise fetch independently.
  private cimdCache = new Map<string, { client: ResolvedClient; expiresAt: number }>()

  // ── Client resolution (CIMD-first, DCR/manual as legacy fallback) ───────

  async resolveClient(clientId: string): Promise<ResolvedClient> {
    if (isClientIdUrl(clientId)) {
      const cached = this.cimdCache.get(clientId)
      if (cached && cached.expiresAt > Date.now()) {
        return cached.client
      }

      try {
        const { doc, ttlSeconds } = await fetchClientMetadataDocument(clientId)
        this.cimdCache.set(clientId, { client: doc, expiresAt: Date.now() + ttlSeconds * 1000 })
        return doc
      } catch (err) {
        this.logger.warn(`CIMD resolution failed for ${clientId}: ${(err as Error).message}`)
        throw new BadRequestException('invalid_client_metadata')
      }
    }

    // Legacy fallback: client pre-registered via the deprecated DCR endpoint,
    // or manually inserted into the DB.
    const client = await this.prisma.oAuthClient.findUnique({ where: { clientId } })
    if (!client) throw new BadRequestException('Unknown client')

    return {
      clientId: client.clientId,
      redirectUris: client.redirectUris,
      scopes: client.scopes,
      clientName: client.clientName,
    }
  }

  // ── Dynamic Client Registration (RFC 7591) — deprecated, kept for backward compat ──

  async registerClient(body: {
    client_name?: string
    redirect_uris: string[]
    grant_types?: string[]
    scope?: string
  }) {
    const clientId = generateToken(16)
    const clientSecret = generateToken(32)
    this.logger.debug(`Registering legacy DCR client: ${clientId}`)

    // Public client — no secret needed when PKCE is enforced
    await this.prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecretHash: sha256(clientSecret), // store hash only
        clientName: body.client_name ?? 'Unknown client',
        redirectUris: body.redirect_uris,
        grantTypes: body.grant_types ?? ['authorization_code', 'refresh_token'],
        scopes: body.scope ? body.scope.split(' ') : ['tasks:read', 'tasks:write'],
      },
    })
    return {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret: clientSecret,
      redirect_uris: body.redirect_uris,
      grant_types: body.grant_types ?? ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'client_secret_post',
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
    const client = await this.resolveClient(params.clientId)
    if (!client.redirectUris.includes(params.redirectUri)) {
      throw new BadRequestException('redirect_uri mismatch')
    }

    const code = generateToken(32)
    await this.prisma.oAuthAuthCode.create({
      data: {
        code,
        clientId: params.clientId, // plain string column — may be a CIMD URL, no FK
        redirectUri: params.redirectUri,
        scopes: params.scopes,
        codeChallenge: params.codeChallenge,
        expiresAt: addSeconds(new Date(), 600), // 10 min
        user: { connect: { id: params.userId } },
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
      throw new BadRequestException('invalid_request')
    }

    try {
      const record = await this.prisma.oAuthAuthCode.findUnique({
        where: { code: body.code },
      })

      if (!record || record.used) {
        throw new UnauthorizedException('invalid_grant')
      }

      if (isBefore(record.expiresAt, new Date())) {
        throw new UnauthorizedException('invalid_grant')
      }

      if (record.clientId !== body.client_id || record.redirectUri !== body.redirect_uri) {
        throw new UnauthorizedException('invalid_grant')
      }

      if (!verifyPkce(body.code_verifier, record.codeChallenge)) {
        throw new UnauthorizedException('invalid_grant')
      }

      // Re-resolve so a since-deleted/broken CIMD document still fails cleanly here
      const client = await this.resolveClient(body.client_id)

      await this.prisma.oAuthAuthCode.update({
        where: { code: body.code },
        data: { used: true },
      })

      return this.issueTokens(client.clientId, record.userId, record.scopes)
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error
      }
      throw new UnauthorizedException('invalid_grant')
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
        clientId, // plain string column — may be a CIMD URL, no FK
        scopes,
        expiresAt: addSeconds(new Date(), 3600), // 1 hour
        refreshExpiresAt: addDays(new Date(), 30), // 30 days
        user: { connect: { id: userId } },
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