import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Like JwtAuthGuard but never throws — sets req.user when a valid Bearer token is present,
 * or leaves req.user undefined when unauthenticated.
 * Used by endpoints (like OAuth authorize) that alter behavior based on authentication state.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_ACCESS_SECRET || 'your-secret-key-change-in-production',
        });

        if (payload?.sub && payload?.email) {
          req.user = { userId: payload.sub, email: payload.email };
        }
      } catch {
        // Token is invalid/expired; leave req.user undefined
      }
    }

    return true; // Guard stays "optional" — controller logic checks if req.user exists
  }
}