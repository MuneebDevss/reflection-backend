// src/auth/strategies/rt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * JWT Strategy for validating JWT tokens for refresh tokens
 * Extracts and validates JWT from Authorization header
 */
@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'rt-secret',
      passReqToCallback: true, // Allows us to access the request object below
    });
  }
  
  /**
   * Validates JWT payload
   * This method is called automatically after JWT is verified
   * The return value is attached to request.user
   */

  validate(req: Request, payload: { sub: string; email: string }) {
    const refreshToken = req.get('Authorization')?.replace('Bearer', '').trim();
    if (!refreshToken) throw new UnauthorizedException('Refresh token missing');
    // Returns both user details and the token itself
    return { ...payload, refreshToken };
  }
}
