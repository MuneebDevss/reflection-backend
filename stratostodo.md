# StratosToDo — Version 1 Technical Specification

## 1. Scope of Version 1

V1 focuses on shipping a solid, deterministic task management core with a minimal but real "smart" layer. The goal is to validate the product before investing in the heavier AI-driven features.

**In scope for V1:**
- Core task CRUD with single-date + estimated-duration model
- Composite priority scoring
- Deterministic daily rescheduling engine (Greedy Fill + Priority Battle)
- Bump count tracking with non-interactive graveyard escalation
- Daily overdue notifications with one-tap reschedule
- Flutter mobile app (Android/iOS first)
- FastAPI backend
- MCP server for external Claude access (Claude.ai / Claude Desktop / Cowork)

**Explicitly deferred to V2+:**
- Task splitting across days
- Load-balanced redistribution
- Semantic grouping / contextual tie-breaking
- In-app chat
- Interactive bump-cap triage (conversational)
- Multi-day plan generation (weight loss, exam prep) via MCP — *stub the tools, but full reasoning quality can improve later*

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | **Flutter** (Riverpod 2, Clean Architecture, MVVM) | Matches existing skillset; single codebase for Android/iOS, Web later |
| Backend API | **FastAPI** (Python) | Fast to build, async support, good fit for Celery/Redis if needed later |
| Database | **PostgreSQL** | Relational integrity for tasks/users; good support for date/time queries |
| Cache / Queue | **Redis** (optional in V1) | For scheduled jobs (daily reschedule cron), can defer if cron is simple enough |
| Auth (App) | **JWT** (access + refresh tokens) | Standard, works well with Flutter Secure Storage |
| Auth (MCP) | **OAuth 2.1** (Authorization Code + PKCE) | Required for remote MCP custom connectors |
| MCP Server | **Python MCP SDK**, hosted as a separate service (HTTPS, remote) | Reuses backend's data layer; deployable independently |
| Hosting | **Render.com / Fly.io** (backend + MCP server), **Supabase or managed Postgres** | Low-cost, simple deploy, matches prior project experience (Reflection app) |
| Push Notifications | **Firebase Cloud Messaging (FCM)** | Cross-platform, already familiar from prior projects |
| Scheduler | **Cron job / APScheduler** (or Celery beat if Redis is added) | Triggers the daily rescheduling pass |

---

## 3. Data Model

### 3.1 `users`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| email | string, unique | |
| password_hash | string | |
| timezone | string | for accurate "daily" boundaries |
| daily_capacity_minutes | integer | default e.g. 480 (8 hrs); user-configurable |
| fcm_token | string, nullable | for push notifications |
| created_at | timestamp | |
| updated_at | timestamp | |

### 3.2 `tasks`
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users) | |
| title | string | |
| description | text, nullable | |
| scheduled_date | date | the single date concept (replaces todo/due split) |
| estimated_minutes | integer | duration estimate |
| base_priority | enum (`low`, `medium`, `high`) | user-set |
| composite_score | float, computed | recalculated on each scheduling pass |
| bump_count | integer, default 0 | incremented on displacement |
| status | enum (`pending`, `completed`, `graveyard`) | |
| created_at | timestamp | |
| updated_at | timestamp | |

### 3.3 `reschedule_log` (audit trail — useful for debugging the engine and future analytics)
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| task_id | UUID (FK → tasks) | |
| from_date | date | |
| to_date | date | |
| reason | enum (`auto_overdue`, `priority_battle_loss`, `manual`) | |
| created_at | timestamp | |

### 3.4 `mcp_tokens` (for MCP OAuth sessions)
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| user_id | UUID (FK → users) | |
| access_token_hash | string | |
| refresh_token_hash | string | |
| expires_at | timestamp | |
| created_at | timestamp | |

---

## 4. Composite Priority Score (V1 formula)

Since the dual-date model is dropped, urgency is derived from how *overdue* a task already is:

```
composite_score = base_priority_value + (days_overdue × overdue_weight)
```

- `base_priority_value`: low = 1, medium = 2, high = 3
- `overdue_weight`: e.g. 0.5 per day overdue (tunable constant)
- A task scheduled for today with `high` priority → score = 3
- A `medium` task that's been bumped twice (2 days overdue) → score = 2 + (2 × 0.5) = 3

This naturally gives older, bumped tasks a fighting chance against fresh high-priority tasks — without needing a separate due-date field.

---

## 5. Rescheduling Engine (Deterministic, Daily Job)

**Trigger:** Daily cron (per user, respecting their timezone) at midnight local time.

**Pipeline:**

```
1. Identify overdue tasks (status = pending, scheduled_date < today)
2. For each overdue task:
   a. Recalculate composite_score
   b. Set target_date = today (Greedy Fill — Strategy #1 + #5 from earlier discussion)
3. For target_date = today:
   a. Sum estimated_minutes of all tasks (existing + incoming) scheduled for today
   b. If sum <= daily_capacity_minutes → all tasks fit, done
   c. If sum > daily_capacity_minutes → trigger Priority Battle:
      - Sort all tasks for today by composite_score (descending)
      - Keep adding tasks to "today" until capacity is filled
      - Remaining tasks → bump_count += 1, scheduled_date = today + 1, log to reschedule_log
4. If bump_count > 2 for any task:
   - Set status = 'graveyard'
   - (Non-interactive — no chat triage in V1. Surface in a "Needs Review" list in-app instead)
5. Send push notification: "You have N overdue tasks — tap to reschedule" (if user hasn't already triggered auto-run)
```

**Manual trigger (notification button):** Same pipeline, runnable on-demand via API endpoint — no AI involved, fully deterministic, instant.

---

## 6. Backend API Endpoints (FastAPI)

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Returns access + refresh JWT |
| POST | `/auth/refresh` | Refresh access token |

### Tasks
| Method | Endpoint | Description |
|---|---|---|
| GET | `/tasks` | List tasks (filterable by date range, status) |
| POST | `/tasks` | Create a task |
| GET | `/tasks/{id}` | Get task detail |
| PUT | `/tasks/{id}` | Update task |
| DELETE | `/tasks/{id}` | Delete task |
| GET | `/tasks/overdue` | List overdue tasks |
| GET | `/tasks/graveyard` | List tasks needing manual review |

### Rescheduling
| Method | Endpoint | Description |
|---|---|---|
| POST | `/reschedule/run` | Manually trigger the deterministic engine (notification button) |
| GET | `/reschedule/log` | View reschedule history for a task |

### User Settings
| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/me` | Get profile + settings |
| PUT | `/users/me` | Update daily capacity, timezone, FCM token |

### MCP OAuth
| Method | Endpoint | Description |
|---|---|---|
| GET | `/oauth/authorize` | OAuth 2.1 authorization endpoint (PKCE) |
| POST | `/oauth/token` | Token exchange/refresh |
| GET | `/.well-known/oauth-authorization-server` | Discovery metadata (required for Claude connector setup) |

---

## 7. MCP Server — Tool Definitions

Hosted as a separate HTTPS service, backed by the same Postgres database (or via internal API calls to the backend). Each tool call is scoped to the authenticated user via the OAuth token.

| Tool | Parameters | Description |
|---|---|---|
| `create_task` | `title, description?, estimated_minutes, scheduled_date, base_priority` | Create a new task |
| `get_tasks` | `start_date, end_date, status?` | Fetch tasks in a date range |
| `update_task` | `task_id, fields` | Update any mutable field |
| `delete_task` | `task_id` | Delete a task |
| `bulk_shift_tasks` | `start_date, end_date, shift_to_date` | Mechanical bulk date shift (single tool call, no per-task reasoning) |
| `get_user_schedule` | `start_date, end_date` | Returns daily load summary (used by Claude before creating multi-task plans) |

> V1 note: `create_task` is the workhorse for "create a plan" requests (weight loss, exam prep). Claude will call it repeatedly in a loop — no special "plan" tool needed yet. A dedicated `create_plan` batch tool can be added in V2 if loop-based creation proves too slow/costly.

---

## 8. Frontend (Flutter) — V1 Features

- **Auth screens:** Login / Register, JWT stored via Flutter Secure Storage
- **Task List / Calendar view:** Daily and weekly views, grouped by `scheduled_date`
- **Task creation/edit:** Title, description, estimated time, priority
- **Overdue / Needs Review screens:** Surfaces graveyard tasks for manual handling
- **Notification handling:** FCM push → deep link → "Reschedule" action calls `/reschedule/run`
- **Settings screen:**
  - Daily capacity (minutes/hours available per day)
  - Timezone
  - **"Connect Claude"** button → deep link to Claude.ai/Desktop connector-add flow with MCP server URL pre-filled
- **Architecture:** MVVM + Riverpod 2 (StateNotifier, code-gen), feature-first modules, Repository pattern for API access — consistent with prior project structure

---

## 9. Build Order (Suggested)

1. Backend: data models, auth, task CRUD endpoints
2. Deterministic rescheduling engine + manual trigger endpoint + cron job
3. Flutter app: auth, task list/calendar, create/edit task, manual reschedule button
4. FCM push notifications + daily overdue check
5. Graveyard / Needs Review screen
6. MCP server: OAuth provider + core tools (`create_task`, `get_tasks`, `update_task`, `delete_task`)
7. MCP: `bulk_shift_tasks`, `get_user_schedule`
8. "Connect Claude" onboarding flow in app
9. End-to-end testing of MCP flows (create plan via Claude.ai, verify tasks appear correctly in app)

---

## 10. Open Questions for V1

- What should `daily_capacity_minutes` default to, and should onboarding ask the user to set it explicitly?
- Should `graveyard` tasks be deletable only, or can users manually re-date them back into the active schedule?
- For OAuth: will you implement your own authorization server, or use a hosted solution (e.g., Auth0, Clerk) to reduce the OAuth implementation burden mentioned earlier?