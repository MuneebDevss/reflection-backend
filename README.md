# Reflection Backend

REST API backend for the Reflection goal-tracking application. The system enables users to create goals through an AI-guided conversational flow, then generates adaptive daily tasks calibrated to each user's performance history. Built with NestJS, Prisma ORM, and PostgreSQL.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Core Systems / Features](#core-systems--features)
5. [Data Management](#data-management)
6. [Setup & Installation](#setup--installation)
7. [Build & Deployment](#build--deployment)
8. [Folder Structure](#folder-structure)
9. [Design Decisions](#design-decisions)
10. [Future Improvements](#future-improvements)

---

## Project Overview

Reflection Backend is a server-side application that powers an AI-assisted goal-tracking platform. Its core responsibilities are:

- **User authentication** — JWT-based registration and login with bcrypt password hashing.
- **Conversational goal creation** — A multi-step session flow where the AI (Google Gemini) generates clarifying questions about a user's raw goal text, collects answers, and synthesizes them into a structured goal with title, description, and deadline.
- **Adaptive daily task generation** — An AI-driven system that analyzes a user's recent task completion history, selects one of five adaptive strategies (Progressive, Balanced, Recovery, Reset, Intervention), and generates appropriately scoped tasks each day.
- **Progress tracking** — Weighted progress calculation based on task difficulty and completion status across all tasks for a goal.

The API follows a modular, layered architecture using the NestJS dependency-injection framework with Prisma as the data-access layer.

---

## Tech Stack

| Category | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20+ (Docker) / 18+ (local) |
| Language | TypeScript | ^5.3.3 |
| Framework | NestJS | ^11.1.12 |
| ORM | Prisma | 6.19.2 |
| Database | PostgreSQL | 15+ |
| AI | Google Generative AI (Gemini 2.5 Flash) | ^0.21.0 |
| Authentication | Passport.js + JWT | passport ^0.7.0, @nestjs/jwt ^11.0.2 |
| Password hashing | bcrypt | ^6.0.0 |
| Validation | class-validator / class-transformer | ^0.14.3 / ^0.5.1 |
| Date utilities | date-fns / date-fns-tz | ^4.1.0 / ^3.2.0 |
| Reactive extensions | RxJS | ^7.8.2 |
| Containerization | Docker (multi-stage, Alpine) | — |
| Process manager (container) | dumb-init | — |

---

## Architecture

The application follows a **modular, layered architecture** provided by NestJS:

```
Client  ──▶  Controller  ──▶  Service  ──▶  PrismaService  ──▶  PostgreSQL
                 │                │
                 │                ├──▶  AiGoalService   ──▶  Google Gemini API
                 │                └──▶  AiTaskService   ──▶  Google Gemini API
                 │
          Guards / Pipes / Interceptors / Filters
```

### Layer Responsibilities

- **Controllers** — Route handling, request parsing, and DTO validation. Controllers contain no business logic.
- **Services** — All business logic, database queries (via `PrismaService`), and AI orchestration.
- **PrismaService** — Singleton wrapper around Prisma Client that manages the database connection lifecycle (`onModuleInit` / `onModuleDestroy`).
- **AI Services** — `AiGoalService` handles goal-related AI calls (question generation, goal summarization). `AiTaskService` handles adaptive task generation including the strategy calculation.
- **Guards** — `JwtAuthGuard` and `LocalAuthGuard` protect routes using Passport strategies.
- **Global interceptors** — `LoggingInterceptor` logs every request/response with timing.
- **Global filters** — `AllExceptionsFilter` catches all unhandled exceptions and returns a standardized JSON error response.
- **Global pipes** — `ValidationPipe` enforces DTO constraints via class-validator decorators.
- **DateTimeService** — Centralized date/time utility injected across the application to ensure consistent UTC-based date handling and testability.

### Module Dependency Graph

`AppModule` imports the following feature modules:

| Module | Purpose |
|---|---|
| `PrismaModule` | Database connection (global singleton) |
| `DateTimeModule` | Date/time utilities (global) |
| `AuthModule` | Registration, login, JWT/local strategies |
| `UsersModule` | User CRUD operations |
| `GoalsModule` | Goal CRUD with weighted progress calculation |
| `AiModule` | AI service wrappers for Gemini API |
| `GoalSessionsModule` | Conversational goal-creation sessions |
| `GoalQuestionsModule` | Question answering within sessions |
| `GoalTasksModule` | Daily task generation, retrieval, and status updates |
| `HealthModule` | `/health` endpoint for liveness checks |

---

## Core Systems / Features

### 1. Authentication System

- **Registration** — `POST /auth/register` accepts email, password, and optional name. Passwords are hashed with bcrypt (10 salt rounds) before storage. Returns a JWT access token.
- **Login** — `POST /auth/login` uses Passport `LocalStrategy` to validate credentials, then issues a JWT.
- **Token validation** — `JwtStrategy` extracts the bearer token from the `Authorization` header, verifies it against `JWT_SECRET`, and attaches `{ userId, email }` to `request.user`.
- **Token expiration** — Tokens expire after 1 day (`signOptions.expiresIn: '1d'`).
- **Route protection** — Apply `@UseGuards(JwtAuthGuard)` to any controller method that requires authentication.

### 2. Conversational Goal Creation (Goal Sessions)

The goal-creation flow is a stateful, multi-step process:

1. **Session start** — `POST /goal-sessions` with `{ userId, rawGoalText }`. The `AiGoalService` sends the raw text to Gemini and receives 5–7 clarification questions with multiple-choice options. The session and questions are persisted in a single Prisma `create` call with nested writes.
2. **Question answering** — `GET /goal-sessions/:id/next-question` returns the first unanswered question. `POST /goal-questions/:id/answer` records the answer. This continues until all questions are answered.
3. **Session completion** — `POST /goal-sessions/:id/complete` collects all answers, sends them with the raw goal text to Gemini for summarization, and creates a `Goal` record with the generated title, description, and deadline. The session is marked `completed` and linked to the new goal.

Fallback question/summary generators are included for when the Gemini API key is not configured or the API call fails.

### 3. Adaptive Task Generation

The task generation system lives in `AiTaskService` and `GoalTasksService`:

- **Trigger** — `POST /goals/:id/generate-tasks` checks if today's tasks already exist (idempotent). If not, it fetches all previous tasks for the goal.
- **Adaptive plan calculation** — `AiTaskService.calculateAdaptivePlan()` analyzes the last 3 days of task history:
  - Computes completion ratio (completed / total).
  - Detects consecutive missed days by grouping tasks by date.
  - Selects a strategy:

    | Strategy | Trigger | Task count adjustment | Difficulty adjustment | Carry-over ratio |
    |---|---|---|---|---|
    | PROGRESSIVE | ≥80% completion | +1 (urgency multiplier near deadline) | +1 | 0% (all new) |
    | BALANCED | 50–80% completion | Maintain | Maintain | 20% adapted |
    | RECOVERY | 20–50% completion | Maintain | −1 | 50% adapted |
    | RESET | <20% completion | −1 | −1 | 70% adapted |
    | INTERVENTION | ≥3 consecutive missed days | −1 | −1 | 80% adapted |

- **AI prompt construction** — The calculated plan (task count, difficulty, adapted-vs-new ratio, strategy explanation) is injected into a structured Gemini prompt along with goal metadata and recent task history.
- **Fallback** — Template-based task generation organized by difficulty level (1–5) is used when the AI is unavailable.
- **Bounds** — Task count is clamped to 1–6, difficulty to 1–5.

### 4. Progress Tracking

Goal progress is **not stored** as a static field. It is computed on every read by:

1. Fetching all `DailyTask` records for the goal.
2. Summing difficulty values for all tasks (`totalDifficulty`) and for completed tasks only (`completedDifficulty`).
3. Computing `progress = round((completedDifficulty / totalDifficulty) * 100)`, clamped to 0–100.

This ensures progress always reflects the actual task state.

### 5. Error Handling

- **Service layer** — Try-catch in every service method. Known exceptions (`NotFoundException`, `BadRequestException`) are re-thrown; unexpected errors are logged and wrapped in `InternalServerErrorException`.
- **Prisma error codes** — Specific handling for `P2002` (unique violation), `P2003` (foreign key violation), `P2025` (record not found).
- **Global exception filter** — `AllExceptionsFilter` catches anything not handled by services and returns a JSON envelope with `statusCode`, `timestamp`, `path`, `method`, `message`, and `error`.
- **Validation pipe** — Returns structured `{ field, errors[] }` objects for DTO validation failures.

### 6. Health Check

`GET /health` returns `{ status: "ok", timestamp, uptime }`. The Docker container uses this endpoint for its `HEALTHCHECK` directive.

---

## Data Management

### Database

PostgreSQL accessed through Prisma ORM. The schema is defined in `prisma/schema.prisma`.

### Schema Overview

| Model | Key Fields | Notes |
|---|---|---|
| `User` | `id` (UUID), `email` (unique), `name?`, `password?` | Password is optional for backward compatibility. |
| `Goal` | `id` (UUID), `userId` (FK), `title`, `description?`, `deadline`, `progress` | Progress field exists in schema but is dynamically recalculated on reads. |
| `DailyTask` | `id` (UUID), `goalId` (FK), `title`, `description?`, `date`, `difficulty` (1–5), `status` (PENDING/COMPLETED/SKIPPED) | Indexed on `[goalId, date]`. |
| `GoalSession` | `id` (UUID), `userId` (FK), `rawGoalText`, `status`, `goalId?` (FK) | Tracks conversational goal-creation flow. |
| `GoalQuestion` | `id` (UUID), `sessionId` (FK), `question`, `options` (String[]), `order` | Indexed on `[sessionId, order]`. |
| `GoalAnswer` | `id` (UUID), `questionId` (FK, unique), `answer` | One answer per question enforced at DB level. |

### Relationships

- `User` → has many `Goal`, has many `GoalSession`
- `Goal` → has many `DailyTask`, has many `GoalSession`
- `GoalSession` → has many `GoalQuestion`
- `GoalQuestion` → has one `GoalAnswer`

### Cascade Deletes

- Deleting a `User` cascades to their `Goal` and `GoalSession` records.
- Deleting a `Goal` cascades to its `DailyTask` records and sets `goalId` to null on linked `GoalSession` records.
- Deleting a `GoalSession` cascades to its `GoalQuestion` records.
- Deleting a `GoalQuestion` cascades to its `GoalAnswer`.

### Migrations

Prisma migrations are stored in `prisma/migrations/` and applied with `prisma migrate dev` (development) or `prisma migrate deploy` (production). Migrations are **not** run automatically inside Docker containers.

---

## Setup & Installation

### Prerequisites

- Node.js 18+ (20+ recommended)
- PostgreSQL 15+
- npm or pnpm
- (Optional) Docker and Docker Compose

### Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MuneebDevss/reflection-backend.git
   cd reflection-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your values:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/reflection?schema=public"
   PORT=3001
   JWT_SECRET=<generate-with-openssl-rand-base64-32>
   GEMINI_API_KEY=<your-google-gemini-api-key>   # optional; fallback logic is used if absent
   ```

4. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

5. **Run database migrations:**
   ```bash
   npm run prisma:migrate
   ```

6. **Start the development server:**
   ```bash
   npm run dev
   ```
   The server starts on `http://localhost:3001`.

### Database Management Commands

| Command | Description |
|---|---|
| `npm run prisma:generate` | Regenerate the Prisma Client |
| `npm run prisma:migrate` | Create and apply a new migration |
| `npm run prisma:push` | Push schema changes without creating a migration |
| `npm run prisma:studio` | Open Prisma Studio (database GUI) |
| `npm run prisma:seed` | Run the database seed script |

---

## Build & Deployment

### Local Build

```bash
npm run build       # Compiles TypeScript to dist/
npm start           # Runs dist/src/main.js
```

### Docker Build

The project uses a multi-stage Dockerfile targeting Node.js 20 Alpine:

```bash
# Build the image
docker build -t reflection-backend .

# Run with environment variables
docker run -p 3001:3001 \
  -e DATABASE_URL="<connection-string>" \
  -e JWT_SECRET="<secret>" \
  -e GEMINI_API_KEY="<key>" \
  reflection-backend
```

**Stage 1 (builder):** Installs all dependencies, generates Prisma Client, compiles TypeScript, then reinstalls production dependencies only.

**Stage 2 (production):** Copies compiled output and production `node_modules` into a clean Alpine image. Runs as a non-root user (`nestjs:nodejs`) with `dumb-init` for proper signal handling.

### Docker Compose (local testing)

```bash
cp .env.example .env
# Fill in .env values
docker-compose up -d
docker-compose logs -f
```

### Database Migrations in Production

Migrations must be run as a separate step before or after container deployment:

```bash
npx prisma migrate deploy
```

They are intentionally excluded from the Docker entrypoint to avoid race conditions with multiple container instances.

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret key for signing JWT tokens |
| `PORT` | No | `3001` | HTTP server port |
| `NODE_ENV` | No | `production` (Docker) | Node environment |
| `GEMINI_API_KEY` | No | — | Google Gemini API key; AI features disabled if absent |

---

## Folder Structure

```
reflection-backend/
├── prisma/
│   ├── migrations/          # Prisma migration files
│   ├── schema.prisma        # Database schema definition
│   └── seed.ts              # Database seed script
├── src/
│   ├── ai/
│   │   ├── ai-goal.service.ts   # AI question generation & goal summarization
│   │   ├── ai-task.service.ts   # Adaptive task generation & strategy calculation
│   │   └── ai.module.ts
│   ├── auth/
│   │   ├── dto/                 # RegisterDto, LoginDto
│   │   ├── guards/              # JwtAuthGuard, LocalAuthGuard
│   │   ├── strategies/          # JwtStrategy, LocalStrategy
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── common/
│   │   └── date-time/           # DateTimeService & DateTimeModule
│   ├── filters/
│   │   └── all-exceptions.filter.ts  # Global exception filter
│   ├── goal-questions/
│   │   ├── dto/
│   │   ├── goal-questions.controller.ts
│   │   ├── goal-questions.service.ts
│   │   └── goal-questions.module.ts
│   ├── goal-sessions/
│   │   ├── dto/
│   │   ├── goal-sessions.controller.ts
│   │   ├── goal-sessions.service.ts
│   │   └── goal-sessions.module.ts
│   ├── goal-tasks/
│   │   ├── dto/
│   │   ├── goal-tasks.controller.ts
│   │   ├── goal-tasks.service.ts
│   │   └── goal-tasks.module.ts
│   ├── goals/
│   │   ├── dto/
│   │   ├── goals.controller.ts
│   │   ├── goals.service.ts
│   │   └── goals.module.ts
│   ├── health/
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   ├── interceptors/
│   │   └── logging.interceptor.ts  # Global request/response logger
│   ├── prisma/
│   │   ├── prisma.service.ts       # Prisma Client lifecycle management
│   │   └── prisma.module.ts
│   ├── users/
│   │   ├── dto/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── app.module.ts               # Root module
│   └── main.ts                     # Application bootstrap
├── Dockerfile                       # Multi-stage production build
├── docker-compose.yml               # Local Docker testing
├── .env.example                     # Environment variable template
├── tsconfig.json                    # TypeScript configuration
├── package.json
└── package-lock.json
```

---

## Design Decisions

- **Dynamic progress calculation** — Progress is computed from task data on every read rather than stored as a denormalized value. This avoids stale data and removes the need for update triggers, at the cost of slightly more computation per query.
- **Adaptive strategy over simple repetition** — Missed tasks are never repeated verbatim. The adaptive plan recalibrates difficulty, count, and carry-over ratio based on recent performance, and the AI generates simplified versions of missed work to reduce user frustration.
- **Stateless adaptive planning** — `calculateAdaptivePlan()` derives its decisions entirely from task history already in the database. No additional state tables or caches are required, keeping the system simple and deterministic for a given input.
- **AI fallback system** — All AI-dependent features (question generation, goal summarization, task generation) have deterministic fallback implementations. The application is fully functional without a Gemini API key.
- **Centralized DateTimeService** — All date/time operations go through an injectable service rather than calling `new Date()` directly. This makes time-dependent logic testable via dependency injection.
- **Multi-stage Docker build** — Separates build-time and runtime dependencies, reducing the production image by ~60–70%. The production stage runs as a non-root user with `dumb-init` for graceful signal handling.
- **Migrations excluded from container startup** — Prevents race conditions and unintended schema changes when scaling horizontally. Migrations are run as a controlled, separate deployment step.
- **Password field optional on User model** — Ensures backward compatibility with users created before the authentication system was added.
- **Cascade deletes** — Configured at the Prisma schema level to maintain referential integrity when parent records are removed, rather than relying on application-level cleanup.
- **Global exception filter and logging interceptor** — Applied at bootstrap rather than per-module, ensuring consistent error responses and request logging across all endpoints without duplicating configuration.

---

## Future Improvements

- Refresh token rotation and token revocation/logout.
- Rate limiting on authentication and AI-generation endpoints.
- Email verification and password reset flow.
- Request ID tracking (correlation IDs) across the full request lifecycle.
- Unit and integration test suites (currently no automated tests).
- Retry logic with exponential backoff for Gemini API calls.
- WebSocket support for real-time task status updates.
- Caching layer (Redis) for frequently accessed goal/task data.
- Pagination on list endpoints (`GET /goals`, `GET /users`).
- Audit logging for sensitive operations (auth events, goal deletions).
- OpenAPI/Swagger documentation auto-generated from controllers.
- Database transaction wrappers for multi-step operations (e.g., session completion).
- Configurable token expiration and password strength requirements via environment variables.
