# StratosToDo MCP Connector — Documentation

StratosToDo is a strategic task and plan manager. This connector lets Claude
view and manage your plans, tasks, and schedule directly from a conversation.

## What you can do

**Plans**
- "Show me my active plans"
- "Create a new plan called Q3 Launch"
- "Rename this plan's description"
- "Delete my old plan"

**Tasks**
- "What are my tasks this week?"
- "Add a task to finish the deck by Friday, high priority, 90 minutes"
- "Mark this task's priority as high"
- "Update the due date on this task"
- "Delete that task"

**Scheduling**
- "How much capacity do I have this week?"
- "Shift all of next Monday's tasks to Wednesday"

## Getting started

1. In Claude, go to **Settings → Connectors → Add custom connector**.
2. Enter the server URL: `https://reflection-backend-rq55.onrender.com/mcp`.
3. Sign in with your StratosToDo account (OAuth) when prompted.
4. Start asking Claude about your plans, tasks, and schedule.

## How authentication works

The connector uses OAuth 2.1 with your existing StratosToDo account — no
separate credentials are needed. Claude never sees your password, and every
action is scoped to your own account only.

## Data & privacy

See our [Privacy Policy](/PRIVACY_POLICY) for details on what data is collected and
how it's used.

## Support

Questions, bugs, or feedback: see [Support](/SUPPORT) or email
**[munib.urehmann@gmail.com]**.
