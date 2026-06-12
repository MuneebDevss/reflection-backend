import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
/**
 * JWT Strategy for validating JWT tokens
 * Extracts and validates JWT from Authorization header
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // FIX: Tell Passport to look inside cookies via a custom extractor
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.['access_token'] || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(), // Optional: fallback to header for easy testing
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || 'your-secret-key-change-in-production',
    });
  }

  /**
   * Validates JWT payload
   * This method is called automatically after JWT is verified
   * The return value is attached to request.user
   */
  async validate(payload: any) {
    console.log('JWT payload validated:', payload);
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return user info that will be attached to request.user
    return {
      userId: payload.sub,
      email: payload.email,
    };
  }
}
