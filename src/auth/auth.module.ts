import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * AuthModule provides JWT-based authentication
 * 
 * Features:
 * - User registration with password hashing
 * - User login with JWT token generation
 * - JWT validation for protected routes
 * - Local strategy for email/password authentication
 * 
 * Configuration:
 * - JWT_SECRET should be set in environment variables
 * - Token expiration is set to 1 day
 * 
 * Usage:
 * - Import AuthModule in AppModule
 * - Use @UseGuards(JwtAuthGuard) on protected routes
 * - Access user info via @Request() req.user in protected routes
 */
@Module({
  imports: [
    // Import UsersModule to use UsersService
    UsersModule,
    
    // Configure Passport for authentication strategies
    PassportModule,
    
    // Configure JWT module
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: {
        expiresIn: '1d', // Token expires in 1 day
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,  // Strategy for validating email/password
    JwtStrategy,    // Strategy for validating JWT tokens
  ],
  exports: [AuthService], // Export AuthService for use in other modules if needed
})
export class AuthModule {}
