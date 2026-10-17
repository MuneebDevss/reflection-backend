# Rescheduling strategies

Rescheduling strategy is selected per rescheduling operation. It is not stored on tasks and must not be sent when creating or editing an individual task.

| Value | Name | Behavior |
| --- | --- | --- |
| `CDU` | Complete Day Update | Compresses pending task date groups from today forward, preserving group order and keeping same-day tasks together. |
| `HPF` | High Priority First | Reschedules overdue pending tasks in priority order, then oldest scheduled date, using daily capacity. |
| `FG` | Fill Gaps | Inserts overdue pending tasks into available capacity while preserving all existing current/future pending task dates. |

## Manual rescheduling API

```http
POST /api/reschedule/run
Authorization: Bearer <access-token>
Content-Type: application/json
```

Request body:

```json
{
  "strategy": "CDU"
}
```

`strategy` is required. The only accepted values are `CDU`, `HPF`, and `FG`.

An optional date can be supplied when the caller needs to override the user's current day:

```json
{
  "strategy": "FG",
  "date": "2026-10-17"
}
```

When `date` is omitted, the backend calculates the current day from the user's timezone. The date must be a valid ISO date string.

Successful response:

```json
{
  "success": true,
  "strategy": "FG",
  "seatedCount": 3,
  "graveyardCount": 0
}
```

If there are no pending overdue tasks:

```json
{
  "success": false,
  "message": "No overdue pending tasks to process."
}
```

Invalid or missing strategy values are rejected by request validation with HTTP `400 Bad Request`.

Only tasks with `status: "pending"` and a scheduled date before the operation date are rescheduling candidates. Completed, graveyard, deleted, and other non-pending tasks are never moved.

## Task APIs

`POST /api/tasks` and `PATCH /api/tasks/:id` must not include a strategy field. Task creation and editing only manage task data such as title, date, duration, priority, and status.

## MCP APIs

MCP task creation, bulk plan task creation, and task updates also do not accept or persist a rescheduling strategy. A strategy is selected only by an explicit rescheduling operation through the REST endpoint above.

## Existing scheduled task behavior

- CDU may move pending current/future tasks because it rebuilds the pending schedule as consecutive date groups.
- HPF and FG preserve existing current/future pending task dates while placing overdue tasks according to capacity.
- No strategy is inferred from task data.
