// src/auth/strategies/rt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      // 1. Update the extraction strategy to read from cookies instead of headers
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.['refresh_token'] || null;
        },
      ]),
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'rt-secret',
      passReqToCallback: true, // Retained so we can grab the raw token string below
    });
  }

  /**
   * Called automatically ONLY after Passport successfully mathematical-validates the JWT.
   */
  async validate(req: Request, payload: { sub: string; email: string }) {
    // 2. Safely grab the raw token string from the cookies for database lookup matching
    const refreshToken = req.cookies?.['refresh_token'];
    
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing from cookies');
    }

    // Returns payload + raw token to be attached to req.user
    return {
      userId: payload.sub,
      email: payload.email,
      refreshToken, 
    };
  }
}