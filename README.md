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

## Adaptive Task Generation

The Reflection backend uses an intelligent adaptive task generation system powered by AI (Google Gemini). Unlike static task generators, this system learns from your performance and adjusts to help you succeed.

### How It Works

Every day when tasks are generated, the system:

1. **Analyzes your recent performance** (last 7-10 tasks)
2. **Calculates your completion ratio** (completed tasks / total tasks)
3. **Detects patterns** like consecutive missed days
4. **Selects an adaptive strategy** based on your performance
5. **Adjusts task count and difficulty** accordingly

### Adaptive Strategies

The system uses five different strategies based on your completion rate:

#### 🚀 PROGRESSIVE (80%+ completion)
You're crushing it! The system:
- Increases difficulty by +1 level
- Adds more tasks
- Generates all NEW challenging tasks to keep you growing

#### ⚖️ BALANCED (50-80% completion)
You're making solid progress. The system:
- Maintains current difficulty
- Keeps task count stable
- Generates mostly new tasks with slight adaptation

#### 🔄 RECOVERY (20-50% completion)
You're struggling a bit. The system:
- Decreases difficulty by -1 level
- Generates 50% adapted tasks (simplified from missed work)
- Reduces scope and duration of adapted tasks

#### 🔄 RESET (<20% completion)
You need support. The system:
- Significantly reduces difficulty
- Generates 70% adapted tasks (much easier versions)
- Focuses on achievable wins to rebuild momentum

#### 🆘 INTERVENTION (3+ consecutive missed days)
You've been away or stuck. The system:
- Sets tasks to minimal difficulty
- Generates 80% adapted tasks (very small, habit-building)
- Creates 5-10 minute micro-tasks to help you restart

### Why Missed Tasks Aren't Simply Repeated

When you miss a task, simply repeating it the next day often leads to:
- **Frustration** - "I already failed this once"
- **Overwhelm** - The task might have been too big
- **Burnout** - Feeling punished instead of supported

Instead, the system **adapts** missed tasks by:
- Breaking them into smaller chunks
- Reducing time commitment
- Simplifying the scope
- Lowering the difficulty

**Example:**
- Original: "Complete chapter 3 exercises"
- Adapted: "Work through 3 problems from chapter 3"
- Adapted (Intervention): "Review 1 example problem from chapter 3"

### Benefits of Adaptive Task Generation

✅ **Prevents burnout** - Reduces load when you're struggling
✅ **Maintains challenge** - Increases difficulty when you're ready
✅ **Builds momentum** - Small wins lead to bigger ones
✅ **Reduces guilt** - Adapts instead of punishes
✅ **Personalizes the experience** - No two users have the same task trajectory

### How Completion Rate Affects You

| Completion Rate | What Happens | Why |
|----------------|--------------|-----|
| 80%+ | More tasks, higher difficulty | You're ready for more challenge |
| 50-80% | Steady state | Current pace is working |
| 20-50% | Easier tasks, half adapted | Need some support |
| <20% | Much easier, mostly adapted | Focus on rebuilding confidence |
| 3+ missed days | Minimal tasks, habit focus | Get back on track gently |

### Implementation Details

The adaptive logic lives in the `AiService.calculateAdaptivePlan()` method, which:
- Never writes to the database during generation
- Uses only recent task history (max 10 tasks)
- Returns a plan with: task count, difficulty, carry-over ratio, and strategy name
- Passes this plan to the AI to guide prompt generation

The system is stateless - all decisions are based on historical data already in the database, ensuring consistency and testability.
