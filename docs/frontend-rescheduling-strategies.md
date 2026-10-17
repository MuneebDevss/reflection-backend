# Rescheduling strategy API contract

This document describes the backend contract for frontend integration. The API is mounted under `/api`.

## Allowed values

`rescheduleStrategy` is either `NDF` (N-Day Forward) or `FEF` (Fill Empty Forward).

- `NDF` is the default for newly created tasks, including manually created tasks and MCP-created tasks.
- Existing tasks migrated from before this field was introduced retain `FEF` for backward compatibility unless changed explicitly.
- A task's stored value is used on future automatic rescheduling runs.

## Task API

`POST /api/tasks` accepts an optional `rescheduleStrategy` field. Omitting it uses `NDF`.

`PATCH /api/tasks/:id` accepts the same optional field and changes the strategy for future rescheduling. It does not reschedule the task immediately.

The task response now includes `rescheduleStrategy`:

```json
{
  "id": "task-uuid",
  "title": "Prepare report",
  "scheduledDate": "2026-10-14T00:00:00.000Z",
  "rescheduleStrategy": "NDF",
  "status": "pending"
}
```

The field is optional in create/update requests and required in new task responses. Clients should treat a missing value from an older deployment or cached object as `FEF`.

## Running rescheduling

`POST /api/reschedule/run` accepts an optional body:

```json
{ "date": "2026-10-14", "strategy": "NDF" }
```

Both fields are optional. Omitting `date` uses the user's local current date. Omitting `strategy` processes each overdue task according to its stored strategy. Supplying `strategy` runs only that strategy for the request.

NDF moves the oldest overdue NDF task date to the current date and shifts all later pending NDF dates by the same number of days, preserving gaps. FEF redistributes overdue FEF tasks into available capacity using priority and overdue age.

The response remains:

```json
{ "success": true, "seatedCount": 3, "graveyardCount": 0 }
```

If no matching overdue tasks exist, the response is `{ "success": false, "message": "No overdue tasks to process." }`.

## MCP tools

MCP `create_task` and `create_and_add_tasks_to_plan` accept optional `rescheduleStrategy`. They default to `NDF`; pass `FEF` explicitly when requested. MCP `update_task` also accepts the optional field. MCP-created tasks therefore expose the same stored task field to REST clients.

## Migration and compatibility

The database migration adds a non-null `tasks.rescheduleStrategy` column. New rows default to `NDF`; tasks migrated from the earlier schema retain `FEF` for compatibility. No frontend migration is required; clients should treat a missing value from an older deployment or cached object as `FEF`.

When allowing users to change the strategy, present `NDF` as “N-Day Forward” and `FEF` as “Fill Empty Forward”, and save the selected enum value through `PATCH /api/tasks/:id`.
