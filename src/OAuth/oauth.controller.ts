import {
  Controller, Get, Post, Req, Res, Query, Body,
  HttpCode, HttpStatus, BadRequestException, UseGuards,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { OAuthService } from './oauth.service'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import 'dotenv/config'

interface AuthenticatedUser {
  userId: string
  email: string
}

@Controller()
export class OAuthController {
  constructor(
    private oauth: OAuthService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // RFC 9728 — Protected Resource Metadata
  // Claude fetches this FIRST when it gets a 401 from your MCP endpoint.
  // ─────────────────────────────────────────────────────────────────────────

  @Get('.well-known/oauth-protected-resource')
  protectedResourceMetadata() {
    const base = process.env.APP_URL // e.g. https://api.stratostodo.com
    return {
      resource: base,
      authorization_servers: [`${base}/.well-known/oauth-authorization-server`],
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RFC 8414 — Authorization Server Metadata
  // Claude fetches this second to learn all your OAuth endpoints.
  // ─────────────────────────────────────────────────────────────────────────

  @Get('.well-known/oauth-authorization-server')
  authServerMetadata() {
    const base = process.env.APP_URL
    return {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,       // DCR
      scopes_supported: ['tasks:read', 'tasks:write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none'],        // public clients only
      code_challenge_methods_supported: ['S256'],             // REQUIRED by Claude
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
  @UseGuards(OptionalJwtAuthGuard)
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('code_challenge_method') codeChallengeMethod: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (responseType !== 'code') {
      throw new BadRequestException('unsupported_response_type')
    }
    if (codeChallengeMethod !== 'S256') {
      throw new BadRequestException('S256 required')
    }

    const user = req.user as AuthenticatedUser | undefined

    if (!user) {
      const returnTo = encodeURIComponent(req.url)
      const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173'
      return res.redirect(`${frontend}/login?returnTo=${returnTo}`)
    }

    const scopes = (scope ?? 'tasks:read tasks:write').split(' ')
    const code = await this.oauth.createAuthCode({
      clientId,
      userId: user.userId,
      redirectUri,
      scopes,
      codeChallenge,
    })

    const callback = new URL(redirectUri)
    callback.searchParams.set('code', code)
    if (state) callback.searchParams.set('state', state)
    return res.redirect(callback.toString())
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
