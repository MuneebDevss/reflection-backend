# Reflection Backend

Backend API for the Reflection app built with NestJS, Prisma, and PostgreSQL.

## Prerequisites

- Node.js 18+
- PostgreSQL database

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Create a `.env` file in the backend directory:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reflection?schema=public"
PORT=3001
```

3. Set up the database:
```bash
# Push the schema to the database
npm run prisma:push

# Or run migrations (recommended for production)
npm run prisma:migrate
```

4. Generate Prisma Client:
```bash
npm run prisma:generate
```

## Development

Start the development server:
```bash
npm run dev
```

The server will run on http://localhost:3001

## Database Management

```bash
# Open Prisma Studio (database GUI)
npm run prisma:studio

# Create a new migration
npm run prisma:migrate

# Push schema changes without migration
npm run prisma:push

# Generate Prisma Client
npm run prisma:generate
```

## API Endpoints

### Users
- `POST /users` - Create a new user
  ```json
  {
    "email": "user@example.com",
    "name": "John Doe"
  }
  ```
- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID

### Goals
- `POST /goals` - Create a new goal
  ```json
  {
    "userId": "uuid",
    "title": "Learn to meditate",
    "deadline": "2024-12-31",
    "progress": 0
  }
  ```
- `GET /goals?userId=<userId>` - Get all goals for a user
- `GET /goals/:id` - Get goal by ID
- `PATCH /goals/:id` - Update goal progress
  ```json
  {
    "progress": 50
  }
  ```
- `DELETE /goals/:id` - Delete a goal

## Database Schema

### User
- `id`: UUID (primary key)
- `email`: String (unique)
- `name`: String (optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime
- `goals`: Goal[] (relation)

### Goal
- `id`: UUID (primary key)
- `userId`: UUID (foreign key)
- `title`: String
- `deadline`: DateTime
- `progress`: Integer (0-100)
- `createdAt`: DateTime
- `updatedAt`: DateTime
- `user`: User (relation)
