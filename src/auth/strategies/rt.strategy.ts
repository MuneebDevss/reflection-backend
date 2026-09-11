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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'rt-secret',
      passReqToCallback: true,
    });
  }

  /**
   * Called automatically ONLY after Passport successfully validates the JWT signature & expiration.
   */
  async validate(req: Request, payload: { sub: string; email: string }) {
    const authHeader = req.headers?.authorization;
    const refreshToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing from Authorization header');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      refreshToken,
    };
  }
}