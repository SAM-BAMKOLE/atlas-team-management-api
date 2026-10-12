# Atlas Backend Handoff

This document describes the backend currently implemented for the Atlas team-management application. It is intended for the frontend implementer.

## Runtime

- Framework: NestJS + TypeScript
- API default URL: `http://localhost:3001`
- Frontend default URL: `http://localhost:3000`
- Database: PostgreSQL on Neon through Prisma
- Authentication: short-lived JWT access tokens plus rotating refresh sessions
- Google OAuth: Passport Google strategy
- Email: SMTP or Gmail through a provider adapter
- Background email delivery: pg-boss on Neon Postgres

Start the API:

```bash
cd api
pnpm install
pnpm db:generate
pnpm start:dev
```

The API health check is `GET /health`.

## Request conventions

Authenticated endpoints require:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

All IDs are UUID strings. Dates are returned as ISO 8601 JSON strings. JSON field names are camelCase.

The global validation pipe strips unknown fields and rejects invalid DTO values. JSON request bodies are limited to 1 MB. CORS is restricted to `CORS_ORIGINS`, and the global throttler allows 100 requests per minute per client.

Typical error format from NestJS is:

```json
{
  "statusCode": 400,
  "message": ["validation message"],
  "error": "Bad Request"
}
```

Common status codes are `400` for invalid input, `401` for missing or invalid authentication, `403` for insufficient workspace permissions, `404` for missing resources, `409` for uniqueness conflicts, and `429` for throttling.

## Authentication endpoints

### `POST /auth/register`

Creates a password account, creates a verification token, queues a verification email, and returns tokens immediately.

Request:

```json
{
  "email": "alex@example.com",
  "password": "correct horse battery staple",
  "name": "Alex Morgan"
}
```

Rules: `email` must be valid; `password` is 8–128 characters; `name` is optional and 1–120 characters.

Response:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-token>",
  "user": {
    "id": "uuid",
    "email": "alex@example.com",
    "name": "Alex Morgan",
    "emailVerifiedAt": null
  }
}
```

### `POST /auth/login`

Request:

```json
{ "email": "alex@example.com", "password": "correct horse battery staple" }
```

Response has the same shape as registration. Invalid credentials return `401`.

### `POST /auth/refresh`

Rotates the supplied refresh session. The previous refresh session is revoked.

Request:

```json
{ "refreshToken": "<refresh-token>" }
```

Response:

```json
{ "accessToken": "<new-jwt>", "refreshToken": "<new-refresh-token>", "expiresAt": "2026-11-08T10:00:00.000Z" }
```

The frontend should replace its stored refresh token with the new one.

### `POST /auth/logout`

Request:

```json
{ "refreshToken": "<refresh-token>" }
```

Response: `{ "success": true }`. Logout is idempotent for an already-revoked token.

### `GET /auth/me`

Requires a bearer access token. Returns the safe user object:

```json
{
  "id": "uuid",
  "email": "alex@example.com",
  "name": "Alex Morgan",
  "emailVerifiedAt": "2026-10-09T10:00:00.000Z"
}
```

### `POST /auth/password-reset/request`

Request: `{ "email": "alex@example.com" }`.

Response is intentionally generic whether or not the account exists:

```json
{ "message": "If an account exists, a password reset email has been sent" }
```

### `POST /auth/password-reset/confirm`

Request:

```json
{ "token": "<token-from-email>", "password": "new password with 8+ chars" }
```

Response: `{ "success": true }`. All active sessions are revoked after a successful reset.

### `POST /auth/verify-email`

Request: `{ "token": "<token-from-email>" }`.

Response: `{ "success": true }`. Tokens expire after 24 hours and are single-use.

### Google OAuth

- `GET /auth/google` starts the Google redirect flow. The frontend should navigate to this API URL or open it as a popup.
- `GET /auth/google/callback` is the Google-authorized backend callback. It creates a two-minute, single-use code and redirects to `APP_URL/auth/oauth/callback?code=...`.
- `POST /auth/google/exchange` exchanges the one-time code for the normal access-token and refresh-token response.

Exchange request:

```json
{ "code": "<one-time-code>" }
```

The code is never an access token, expires quickly, and cannot be reused.

The Google callback requires a verified Google email. Existing accounts are linked by email; a different Google account cannot replace an existing Google subject.

## Workspace endpoints

All workspace routes require a bearer token. Workspace-scoped routes also require membership in the requested workspace.

Membership roles are exactly: `OWNER`, `ADMIN`, `MEMBER`.

### `POST /workspaces`

Creates a workspace and makes the caller its owner.

Request:

```json
{ "name": "Northstar Team", "slug": "northstar-team" }
```

`slug` is optional. If omitted, it is derived from `name`. Names are 2–80 characters; slugs are lowercase letters, numbers, and hyphens.

Response:

```json
{
  "id": "workspace-uuid",
  "name": "Northstar Team",
  "slug": "northstar-team",
  "createdAt": "2026-10-09T10:00:00.000Z",
  "updatedAt": "2026-10-09T10:00:00.000Z"
}
```

### `GET /workspaces`

Lists the caller’s memberships. Each item contains the membership record and nested workspace:

```json
[
  {
    "id": "membership-uuid",
    "userId": "user-uuid",
    "workspaceId": "workspace-uuid",
    "role": "OWNER",
    "createdAt": "2026-10-09T10:00:00.000Z",
    "updatedAt": "2026-10-09T10:00:00.000Z",
    "workspace": {
      "id": "workspace-uuid",
      "name": "Northstar Team",
      "slug": "northstar-team",
      "createdAt": "2026-10-09T10:00:00.000Z",
      "updatedAt": "2026-10-09T10:00:00.000Z"
    }
  }
]
```

### `GET /workspaces/:workspaceId`

Returns the workspace with memberships. Each membership includes a safe user projection (`id`, `email`, `name`).

### `PATCH /workspaces/:workspaceId`

Owner or admin only. Request: `{ "name": "Updated team name" }`.

### `PATCH /workspaces/:workspaceId/members/:userId/role`

Owner or admin only. Request: `{ "role": "MEMBER" }`.

Ownership transfer is not currently supported. An owner cannot be demoted.

### `DELETE /workspaces/:workspaceId/members/:userId`

Owner or admin only. Removes a member. The owner cannot be removed. Response: `{ "success": true }`.

### `POST /workspaces/:workspaceId/invitations`

Owner or admin only. Creates a seven-day, single-use invitation and queues an email.

Request:

```json
{ "email": "newmember@example.com", "role": "MEMBER" }
```

Response:

```json
{
  "id": "invitation-uuid",
  "email": "newmember@example.com",
  "role": "MEMBER",
  "expiresAt": "2026-10-16T10:00:00.000Z",
  "emailJobId": "pg-boss-job-id"
}
```

### `POST /invitations/accept`

Requires authentication. The authenticated account email must match the invitation email.

Request: `{ "token": "<token-from-email>" }`.

Response: `{ "workspaceId": "workspace-uuid", "role": "MEMBER" }`.

## Project and board endpoints

All project routes require a bearer token and workspace membership. Updating a project is restricted to owners and admins.

### `POST /workspaces/:workspaceId/projects`

Request:

```json
{
  "name": "Product launch",
  "slug": "product-launch",
  "description": "Coordinate the public launch."
}
```

`slug` is optional and derived from `name` when omitted. Response is the created project with `id`, `workspaceId`, `name`, `slug`, `description`, `archived`, `createdAt`, and `updatedAt`.

### `GET /workspaces/:workspaceId/projects`

Returns projects ordered by creation time. Each project includes a `boards` array; boards include their basic fields but not columns.

### `GET /workspaces/:workspaceId/projects/:projectId`

Returns one project with `boards`. Each board includes a `columns` array ordered by `position`.

### `GET /workspaces/:workspaceId/projects/:projectId/tasks`

Returns every task across the project's boards (the project "Tasks" page). By default only non-archived tasks are returned; pass `?archived=true` for the archived ones. Ordered by `boardId`, then `columnId`, then `position`. Each task includes `assignees`, `labels`, plus a `board` and a `column` with `id` and `name`. Verifies the project belongs to the workspace.

### `PATCH /workspaces/:workspaceId/projects/:projectId`

Owner or admin only. Any provided fields may be changed:

```json
{ "name": "Launch v2", "description": "Updated description", "archived": false }
```

### `POST /workspaces/:workspaceId/projects/:projectId/boards`

Request: `{ "name": "Engineering board" }`.

Response is the created board: `id`, `projectId`, `name`, `createdAt`, and `updatedAt`.

### `PATCH /workspaces/:workspaceId/projects/:projectId/boards/:boardId`

Renames a board. Available to any workspace member.

Request: `{ "name": "Engineering board v2" }` (2–100 characters). Response is the updated board.

### `DELETE /workspaces/:workspaceId/projects/:projectId/boards/:boardId`

Owner or admin only. Permanently deletes the board; its columns and tasks are removed by database cascade. Response: `{ "success": true }`.

### `POST /workspaces/:workspaceId/projects/:projectId/boards/:boardId/columns`

Request:

```json
{ "name": "In progress", "position": 1 }
```

`position` is a non-negative integer and must be unique within the board. Response is the created column with `id`, `boardId`, `name`, `position`, `createdAt`, and `updatedAt`.

### `PATCH /workspaces/:workspaceId/projects/:projectId/boards/:boardId/columns/:columnId`

Renames a column and/or moves it to a new position. Available to any workspace member. At least one of `name` (1–80 characters) or `position` (non-negative integer) is required:

```json
{ "name": "In review", "position": 1 }
```

Moving reorders within the board: the column is inserted at the requested index and the remaining columns are renumbered to stay contiguous. Out-of-range positions clamp to the end of the board. Response is the updated column.

### `DELETE /workspaces/:workspaceId/projects/:projectId/boards/:boardId/columns/:columnId`

Owner or admin only. When the column still holds tasks the request fails with `409` unless `?force=true` is passed, which deletes those tasks as well (comments, assignees, and labels follow by cascade). Surviving columns are renumbered to close the gap. Response: `{ "success": true }`.


## Task endpoints

The full route prefix is:

```text
/workspaces/:workspaceId/projects/:projectId/boards/:boardId/tasks
```

All task routes require a bearer token and workspace membership. Every service call verifies the workspace → project → board → task relationship.

Task priorities are `LOW`, `MEDIUM`, `HIGH`, and `URGENT`. New tasks default to `MEDIUM` when `priority` is omitted.

### `POST .../tasks`

Request:

```json
{
  "title": "Prepare launch checklist",
  "description": "Review the final launch steps.",
  "priority": "HIGH",
  "dueDate": "2026-10-14T17:00:00.000Z",
  "columnId": "column-uuid",
  "position": 0
}
```

Required fields are `title` (1–200 characters) and `columnId`. `description` is optional (up to 5,000 characters), `dueDate` must be an ISO date string, and `position` defaults to `0`.

Response includes the task plus `assignees`. Assignees include a nested safe user:

```json
{
  "id": "task-uuid",
  "boardId": "board-uuid",
  "columnId": "column-uuid",
  "title": "Prepare launch checklist",
  "description": "Review the final launch steps.",
  "priority": "HIGH",
  "dueDate": "2026-10-14T17:00:00.000Z",
  "position": 0,
  "archived": false,
  "createdAt": "2026-10-09T10:00:00.000Z",
  "updatedAt": "2026-10-09T10:00:00.000Z",
  "assignees": [],
  "labels": [
    {
      "taskId": "task-uuid",
      "labelId": "label-uuid",
      "assignedAt": "2026-10-09T10:00:00.000Z",
      "label": {
        "id": "label-uuid",
        "workspaceId": "workspace-uuid",
        "name": "Bug",
        "color": "#EF4444",
        "createdAt": "2026-10-09T10:00:00.000Z",
        "updatedAt": "2026-10-09T10:00:00.000Z"
      }
    }
  ]
}
```

### `GET .../tasks`

Returns tasks ordered by `columnId`, then `position`. By default only non-archived tasks are returned; pass `?archived=true` to list the archived ones instead. The response shape is an array of task objects with nested assignees and nested labels (`taskId`, `labelId`, `assignedAt`, and `label`).

### `GET .../tasks/:taskId`

Returns one task by id (archived or not), with nested assignees and labels — used for deep links to archived tasks.

### `PATCH .../tasks/:taskId`

Request fields are optional:

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "priority": "MEDIUM",
  "dueDate": null,
  "archived": false
}
```

Set `dueDate` to `null` to clear it. The response is the updated task with nested assignees.

### `DELETE .../tasks/:taskId`

Archives the task (soft delete): it stays in the database with its comments, assignees, and labels but no longer appears in `GET .../tasks`. Response is the archived task with nested assignees and labels. To restore it, `PATCH` the task with `{ "archived": false }`.

### `DELETE .../tasks/:taskId/permanent`

Owner or admin only. Permanently deletes the task; its comments, assignees, labels, and activity are removed by database cascade. Response: `{ "success": true }`.


### `POST .../tasks/:taskId/move`

Request: `{ "columnId": "destination-column-uuid", "position": 2 }`.

The destination column must belong to the same board. Response is the updated task’s basic record.

### `PUT .../tasks/:taskId/assignees/:userId`

Assigns a workspace member to the task. No body is required. Response: `{ "success": true }`.

### `DELETE .../tasks/:taskId/assignees/:userId`

Removes the assignment. No body is required. Response: `{ "success": true }`.

## Comments, labels, and activity

### `POST .../tasks/:taskId/comments`

Request: `{ "body": "I have updated the launch copy." }`.

The body must contain 1–5,000 characters. Response:

```json
{
  "id": "comment-uuid",
  "taskId": "task-uuid",
  "authorId": "user-uuid",
  "body": "I have updated the launch copy.",
  "createdAt": "2026-10-09T10:00:00.000Z",
  "updatedAt": "2026-10-09T10:00:00.000Z",
  "author": { "id": "user-uuid", "name": "Alex Morgan", "email": "alex@example.com" }
}
```

### `GET .../tasks/:taskId/comments`

Returns comments in ascending `createdAt` order. Each comment contains the same author projection shown above.

### `POST /workspaces/:workspaceId/labels`

Creates a workspace label.

Request: `{ "name": "Bug", "color": "#EF4444" }`.

`name` is 1–50 characters. `color` must be a hexadecimal color. Label names are unique within a workspace. Response contains `id`, `workspaceId`, `name`, `color`, `createdAt`, and `updatedAt`.

### `GET /workspaces/:workspaceId/labels`

Returns workspace labels ordered alphabetically by name.

### `PUT .../tasks/:taskId/labels/:labelId`

Adds a workspace label to a task. No body is required. Response: `{ "success": true }`.

### `DELETE .../tasks/:taskId/labels/:labelId`

Removes a label from a task. No body is required. Response: `{ "success": true }`.

### `GET .../tasks/:taskId/activity`

Returns task activity events in descending `createdAt` order:

```json
{
  "id": "activity-uuid",
  "workspaceId": "workspace-uuid",
  "taskId": "task-uuid",
  "actorId": "user-uuid",
  "type": "COMMENT_ADDED",
  "metadata": { "commentId": "comment-uuid" },
  "createdAt": "2026-10-09T10:00:00.000Z",
  "actor": { "id": "user-uuid", "name": "Alex Morgan", "email": "alex@example.com" }
}
```

Currently recorded activity types are `COMMENT_ADDED`, `LABEL_ADDED`, and `LABEL_REMOVED`. The enum also reserves `TASK_CREATED`, `TASK_UPDATED`, `TASK_MOVED`, `TASK_ASSIGNED`, and `TASK_UNASSIGNED` for future task audit logging.

## Frontend integration notes

1. Store the access token in the client auth state and send it as a bearer token.
2. Store the refresh token securely enough for the chosen frontend environment and rotate it after every `/auth/refresh` response.
3. On `401`, attempt one refresh, replace both tokens, and retry the original request. If refresh fails, clear auth state and redirect to login.
4. Use the workspace ID, project ID, board ID, column ID, and task ID returned by the API rather than deriving IDs from slugs or names.
5. Treat invitation, verification, and password-reset emails as asynchronous. Invitation creation returns an `emailJobId`; delivery is handled by the API worker.
6. The Google OAuth endpoint is a browser redirect flow, not a JSON login endpoint.

## Environment used by the API

The frontend-facing values are:

```env
PORT=3001
CORS_ORIGINS=http://localhost:3000
APP_URL=http://localhost:3000
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

The API also requires the Neon `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, `JWT_SECRET`, Google OAuth credentials, and email provider settings. Secrets must remain in `api/.env` and must not be committed.

