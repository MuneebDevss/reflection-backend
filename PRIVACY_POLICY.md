# Privacy Policy — StratosToDo

_Last updated: [2026-05-07]_

This policy explains what data StratosToDo ("the App", "the Service")
collects, how it's used, and how you can contact us about it. This applies
both to the StratosToDo web app (https://stratos-todo.vercel.app) and to the
StratosToDo MCP connector that exposes its tools to AI assistants such as
Claude.

## What we collect

- **Account information**: email address and password (stored as a salted
  hash, never in plain text) used for authentication.
- **Timezone**: used to correctly schedule and display tasks in your local
  time.
- **Plans and tasks**: plan names/descriptions, task titles, descriptions,
  estimated durations, priorities, scheduled dates, and completion status.
- **Basic technical data**: standard request metadata (timestamps, error
  logs) used for debugging and reliability. We do not track location or
  device identifiers beyond what's required for authentication.

## How we use it

- To provide core app functionality: authentication, storing and organizing
  your plans and tasks, and calculating your schedule capacity.
- To diagnose bugs and maintain service reliability.

We do not sell your data, and we do not use your plan or task content for
advertising.

## Third-party sharing

- **Hosting infrastructure**: the app is hosted on Vercel; the backend and
  database run on our hosting providers, who process data on our behalf and
  do not use it for their own purposes.
- We do not share your data with any other third party.

## Data retention

- Account, plan, and task data are retained for as long as your account is
  active.
- You can request deletion of your account and associated data at any time
  by contacting us (see below) — we will delete it within 30 days.

## Your choices

- You can request a copy of your data or request deletion at any time.
- You can revoke the MCP connector's access at any time from Claude's
  Connectors settings, independent of your account itself.

## MCP Connector specifically

If you access StratosToDo through the MCP connector (e.g. via Claude), the
connector authenticates with your existing account via OAuth. Every action
Claude takes — viewing, creating, updating, or deleting plans and tasks — is
scoped to your own account only. The connector does not collect additional
data beyond what's described above, and does not read data outside what a
given tool call explicitly requests.

## Contact

Questions about this policy or your data: **munib.urehmann@gmail.com**
