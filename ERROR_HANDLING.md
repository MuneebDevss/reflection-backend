# Error Handling Documentation

## Overview

The backend implements comprehensive error handling with try-catch blocks, proper HTTP exceptions, logging, and validation at multiple levels.

## Error Handling Strategy

### 1. Service Layer Error Handling

All services (UsersService, GoalsService) implement try-catch blocks with:
- **Input validation**: UUID format, date validation
- **Existence checks**: Verify entities exist before operations
- **Specific error types**: Different exceptions for different scenarios
- **Logging**: All errors are logged with context
- **Prisma error handling**: Special handling for database-specific errors

### 2. Global Exception Filter

Location: `src/filters/all-exceptions.filter.ts`

Catches all unhandled exceptions and:
- Logs the error with full context
- Returns standardized error response
- Includes timestamp, path, and method
- Handles both HttpExceptions and generic errors

### 3. Request/Response Logging

Location: `src/interceptors/logging.interceptor.ts`

Logs all HTTP requests and responses:
- Request: method, URL, body (debug mode)
- Response: status code, execution time
- Errors: error message, execution time

### 4. Input Validation

- **DTO validation**: class-validator decorators on all DTOs
- **Global validation pipe**: Configured in main.ts
- **Custom error messages**: Descriptive validation errors

## HTTP Status Codes

| Code | Exception | Use Case |
|------|-----------|----------|
| 400  | BadRequestException | Invalid input format, validation errors |
| 404  | NotFoundException | Resource not found (user, goal) |
| 409  | ConflictException | Duplicate resource (email already exists) |
| 500  | InternalServerErrorException | Unexpected errors, database issues |

## Error Response Format

All errors return a standardized JSON format:

```json
{
  "statusCode": 404,
  "timestamp": "2026-01-26T12:00:00.000Z",
  "path": "/goals/invalid-id",
  "method": "GET",
  "message": "Goal with ID invalid-id not found",
  "error": "Not Found"
}
```

## Validation Errors

Validation errors have a special format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "errors": ["email must be an email"]
    }
  ]
}
```

## Prisma-Specific Error Handling

The services handle common Prisma error codes:

- **P2002**: Unique constraint violation (e.g., duplicate email)
- **P2003**: Foreign key constraint violation (e.g., invalid userId)
- **P2025**: Record not found (e.g., trying to update non-existent goal)

## Logging Levels

### Info/Log
- Successful database connections
- HTTP request/response summaries
- Application startup

### Error
- Service operation failures
- Database errors
- Validation failures
- Unhandled exceptions

### Debug
- Request body content
- Detailed operation traces

## Error Handling Examples

### 1. Create Goal with Invalid User

**Request:**
```bash
POST /goals
{
  "userId": "non-existent-id",
  "title": "Learn NestJS",
  "deadline": "2024-12-31",
  "progress": 0
}
```

**Response:**
```json
{
  "statusCode": 404,
  "timestamp": "2026-01-26T12:00:00.000Z",
  "path": "/goals",
  "method": "POST",
  "message": "User with ID non-existent-id not found",
  "error": "Not Found"
}
```

### 2. Create User with Duplicate Email

**Request:**
```bash
POST /users
{
  "email": "existing@example.com",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "statusCode": 409,
  "timestamp": "2026-01-26T12:00:00.000Z",
  "path": "/users",
  "method": "POST",
  "message": "A user with this email already exists",
  "error": "Conflict"
}
```

### 3. Invalid UUID Format

**Request:**
```bash
GET /goals/not-a-uuid
```

**Response:**
```json
{
  "statusCode": 400,
  "timestamp": "2026-01-26T12:00:00.000Z",
  "path": "/goals/not-a-uuid",
  "method": "GET",
  "message": "Invalid goal ID format",
  "error": "Bad Request"
}
```

### 4. Validation Error

**Request:**
```bash
POST /goals
{
  "userId": "user-1",
  "title": "",
  "deadline": "invalid-date",
  "progress": 150
}
```

**Response:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "errors": ["title should not be empty"]
    },
    {
      "field": "deadline",
      "errors": ["deadline must be a valid ISO 8601 date string"]
    },
    {
      "field": "progress",
      "errors": ["progress must not be greater than 100"]
    }
  ]
}
```

## Best Practices

### In Services

```typescript
async findOne(id: string) {
  try {
    // 1. Validate input
    if (!this.isValidUUID(id)) {
      throw new BadRequestException('Invalid ID format');
    }

    // 2. Perform operation
    const result = await this.prisma.model.findUnique({ where: { id } });

    // 3. Check result
    if (!result) {
      throw new NotFoundException(`Resource ${id} not found`);
    }

    return result;
  } catch (error) {
    // 4. Re-throw known exceptions
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }

    // 5. Log and throw internal error for unexpected errors
    this.logger.error(`Operation failed: ${error.message}`, error.stack);
    throw new InternalServerErrorException('Operation failed');
  }
}
```

### In Controllers

Controllers don't need try-catch blocks because:
- Services handle all business logic errors
- Global exception filter catches unhandled errors
- Validation pipe handles input validation

```typescript
@Get(':id')
async findOne(@Param('id') id: string) {
  // No try-catch needed - service handles errors
  return this.service.findOne(id);
}
```

## Testing Error Scenarios

### Test Invalid UUID
```bash
curl http://localhost:3001/goals/invalid-uuid
```

### Test Non-existent Resource
```bash
curl http://localhost:3001/goals/00000000-0000-0000-0000-000000000000
```

### Test Duplicate User
```bash
# Create user first
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test"}'

# Try to create again
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test"}'
```

### Test Validation Errors
```bash
curl -X POST http://localhost:3001/goals \
  -H "Content-Type: application/json" \
  -d '{"userId":"","title":"","deadline":"invalid","progress":200}'
```

## Monitoring and Debugging

### View Logs
The application logs all operations with context:

```
[HTTP] ➡️  POST /goals
[HTTP] ⬅️  POST /goals 201 - 45ms

[GoalsService] Failed to create goal: User with ID xxx not found
[HTTP] ❌ POST /goals - User with ID xxx not found - 23ms
```

### Enable Debug Logging
Set environment variable:
```env
LOG_LEVEL=debug
```

## Future Enhancements

- [ ] Add request ID tracking across the stack
- [ ] Implement retry logic for transient failures
- [ ] Add metrics/monitoring integration (Prometheus, Datadog)
- [ ] Rate limiting for API endpoints
- [ ] Custom error codes for better client handling
- [ ] Audit logging for sensitive operations
- [ ] Database transaction rollback on errors
