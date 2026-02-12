# Authentication Module

JWT-based authentication system for the Reflection backend API.

## Features

- ✅ User registration with email and password
- ✅ Secure password hashing using bcrypt
- ✅ JWT token generation and validation
- ✅ Login with email/password
- ✅ Route protection with JWT guards
- ✅ Backward compatible with existing user system

## Endpoints

### Register
**POST** `/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe" // optional
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-02-12T...",
    "updatedAt": "2026-02-12T..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login
**POST** `/auth/login`

Authenticate with existing credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-02-12T...",
    "updatedAt": "2026-02-12T..."
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Protecting Routes

To protect routes with JWT authentication, use the `JwtAuthGuard`:

```typescript
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('protected')
export class ProtectedController {
  @UseGuards(JwtAuthGuard)
  @Get()
  async getProtectedData(@Request() req) {
    // Access authenticated user info
    const userId = req.user.userId;
    const email = req.user.email;
    
    return { message: 'This is protected data', user: req.user };
  }
}
```

## Making Authenticated Requests

Include the JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3001/protected
```

## Environment Variables

Add to your `.env` file:

```env
JWT_SECRET=your-secret-key-change-in-production
```

**Important:** Generate a strong random secret for production:
```bash
openssl rand -base64 32
```

## Architecture

### Components

- **AuthController** - Handles registration and login endpoints
- **AuthService** - Business logic for authentication
- **LocalStrategy** - Validates email/password during login
- **JwtStrategy** - Validates JWT tokens for protected routes
- **JwtAuthGuard** - Guard for protecting routes
- **LocalAuthGuard** - Guard for login endpoint

### Password Security

- Passwords are hashed using bcrypt with 10 salt rounds
- Plain text passwords are never stored
- Passwords are excluded from API responses

### Token Structure

JWT tokens include:
- `sub`: User ID
- `email`: User email
- `exp`: Expiration time (1 day)

## Error Responses

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "A user with this email already exists"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["Password must be at least 6 characters long"],
  "error": "Bad Request"
}
```

## Backward Compatibility

- Password field is optional in User model
- Existing users without passwords can still be queried
- All existing API routes remain unchanged
- No breaking changes to existing modules

## Testing

### Test Registration
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Test Protected Route
```bash
# Replace TOKEN with the access_token from login response
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/protected
```

## Security Best Practices

1. ✅ Use HTTPS in production
2. ✅ Set strong JWT_SECRET in production
3. ✅ Consider shorter token expiration times for sensitive apps
4. ✅ Implement refresh tokens for long-lived sessions
5. ✅ Add rate limiting to login endpoint
6. ✅ Log authentication failures for monitoring
7. ✅ Consider adding email verification
8. ✅ Add password reset functionality

## Next Steps

Consider adding:
- Refresh token mechanism
- Email verification
- Password reset flow
- Two-factor authentication
- Rate limiting
- Account lockout after failed attempts
