import { AuthService } from '@auth/auth.service';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Like JwtAuthGuard but never throws — returns undefined user when unauthenticated.
 * Used by the OAuth authorize endpoint to redirect to login instead of 401.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const tryVerify = (token: string, secret: string) => {
      try { return this.jwtService.verify(token, { secret }); }
      catch { return null; }
    };

    const accessToken = req.cookies?.access_token;
    if (accessToken) {
      const payload = tryVerify(accessToken, process.env.JWT_ACCESS_SECRET!);
      if (payload) {
        req.user = { userId: payload.sub, email: payload.email };
        return true;
      }
    }

    // access token missing/expired — try silent refresh
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const payload = tryVerify(refreshToken, process.env.JWT_REFRESH_SECRET!);
      if (payload) {
        await this.authService.generateTokens(payload.email, payload.sub, res); // reissues both cookies
        req.user = { userId: payload.sub, email: payload.email };
        return true;
      }
    }

    return true; // guard stays "optional" — controller decides what to do with req.user
  }
}
