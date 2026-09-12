import {
  Controller, Get, Post, Req, Res, Query, Body,
  HttpCode, HttpStatus, BadRequestException, UseGuards,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { OAuthService } from './oauth.service'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import 'dotenv/config'
import { JwtAuthGuard } from '@auth/guards/jwt-auth.guard'

interface AuthenticatedUser {
  userId: string
  email: string
}

@Controller()
export class OAuthController {
  constructor(
    private oauth: OAuthService,
  ) {}
  private readonly logger = new Logger(OAuthController.name);
  // ─────────────────────────────────────────────────────────────────────────
  // RFC 9728 — Protected Resource Metadata
  // Claude fetches this FIRST when it gets a 401 from your MCP endpoint.
  // ─────────────────────────────────────────────────────────────────────────
  // What claude.ai fetches at step 2 of the handshake:
  @Get('.well-known/oauth-protected-resource/mcp')  // /mcp suffix add karo
  protectedResourceMetadata() {
    this.logger.debug('Fetching protected resource metadata')
    const base = process.env.APP_URL
    return {
      resource: `${base}/mcp`,
      authorization_servers: [`${base}`],          
      bearer_methods_supported: ['header'],
      scopes_supported: ['tasks:read', 'tasks:write'],
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RFC 8414 — Authorization Server Metadata
  // Claude fetches this second to learn all your OAuth endpoints.
  // ─────────────────────────────────────────────────────────────────────────

  @Get('.well-known/oauth-authorization-server')
  authServerMetadata() {
    const base = (process.env.APP_URL ?? '').replace(/\/api\/?$/, '')
    return {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`, // kept only for legacy DCR clients
      client_id_metadata_document_supported: true,      // <-- new
      scopes_supported: ['tasks:read', 'tasks:write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'none'], // CIMD clients are public
      code_challenge_methods_supported: ['S256'],
      service_documentation: `${base}/docs`,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dynamic Client Registration (RFC 7591)
  // Claude POSTs here to self-register before starting the auth flow.
  // ─────────────────────────────────────────────────────────────────────────

  @Post('oauth/register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: any) {
    return this.oauth.registerClient(body)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Authorization endpoint
  // Claude opens this in a browser. User logs in → sees consent page → approves.
  // On approval, redirect to Claude's callback with ?code=...
  // ─────────────────────────────────────────────────────────────────────────

  
  @Get('oauth/authorize')
  authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Res() res: Response,
  ) 
  {
    if (responseType !== 'code') {
      throw new BadRequestException('unsupported_response_type')
    }
    if (codeChallengeMethod !== 'S256') {
      throw new BadRequestException('S256 required')
    }

    // We can't determine auth state here — this is a top-level nav from
    // Claude, and no cross-site cookie survives it (Firefox partitions
    // cookies by top-level site regardless of SameSite). Hand off to the
    // frontend, which owns the JWT in localStorage.
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173'
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: responseType,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
    })
    if (scope) params.set('scope', scope)
    if (state) params.set('state', state)

    return res.redirect(`${frontend}/oauth/consent?${params.toString()}`)
  }

  @Post('oauth/authorize/complete')
  @UseGuards(JwtAuthGuard) // your REAL guard, not Optional — this is an XHR call with a Bearer header
  async completeAuthorize(
    @Body() body: {
      client_id: string
      redirect_uri: string
      code_challenge: string
      scope?: string
      state?: string
    },
    @Req() req: Request,
  ) {
    const user = req.user as AuthenticatedUser
    const scopes = (body.scope ?? 'tasks:read tasks:write').split(' ')

    const code = await this.oauth.createAuthCode({
      clientId: body.client_id,
      userId: user.userId,
      redirectUri: body.redirect_uri,
      scopes,
      codeChallenge: body.code_challenge,
    })

    const callback = new URL(body.redirect_uri)
    callback.searchParams.set('code', code)
    if (body.state) callback.searchParams.set('state', body.state)

    return { redirectUrl: callback.toString() }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Token endpoint
  // Called by Claude to exchange the auth code for access + refresh tokens.
  // Also called for refresh_token grant.
  // ─────────────────────────────────────────────────────────────────────────

  @Post('oauth/token')
  @HttpCode(HttpStatus.OK)
  async token(@Body() body: any) {
    return this.oauth.exchangeCode(body)
  }
}
