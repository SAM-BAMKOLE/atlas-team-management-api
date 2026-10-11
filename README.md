# Atlas Team Management API

NestJS API foundation for the multi-tenant team management application.

## Phase I status

- NestJS TypeScript service scaffolded under `api/`
- Strict TypeScript configuration
- ESLint and Prettier scripts
- Environment variable template
- Neon PostgreSQL connection and Prisma migrations
- GitHub Actions CI workflow

## Local setup

```bash
cd api
pnpm install
copy .env.example .env
pnpm start:dev
```

Set both Neon connection variables in `api/.env`. Use the pooled
`DATABASE_URL` for application traffic and the direct `DATABASE_URL_UNPOOLED`
for Prisma migrations, then initialize the database:

```bash
cd api
pnpm db:generate
pnpm db:migrate --name init
pnpm db:seed
```

The API runs on `http://localhost:3001` by default and exposes `GET /health`.
Set `PORT` and `CORS_ORIGINS` in `api/.env` when using a different frontend URL.

## Authentication

Set `JWT_SECRET` and `JWT_ACCESS_TTL_SECONDS` in `api/.env`. The API exposes:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me` with a Bearer access token
- `GET /auth/google` to begin Google OAuth
- `GET /auth/google/callback` as the Google backend callback
- `POST /auth/google/exchange` to exchange the frontend callback code for tokens

Email verification and password recovery use the configured email provider and
are delivered through the pg-boss background worker.

For Google OAuth, create a Google OAuth web client and add the backend callback
URL from `GOOGLE_CALLBACK_URL` to its authorized redirect URIs. The backend
redirects to `APP_URL/auth/oauth/callback?code=...`; the frontend should POST
that one-time code to `/auth/google/exchange`. Add the three Google variables
to `api/.env` before starting the API.

## Workspaces

Authenticated users can create and list workspaces. Workspace members can read
workspace data, while owners and admins can update workspace details and manage
member roles. The workspace guard checks membership on every workspace-scoped
route before the handler runs.

Workspace owners and admins can invite members with
`POST /workspaces/:workspaceId/invitations`. The invitation is single-use and
expires after seven days; acceptance uses `POST /invitations/accept` with an
authenticated account whose email matches the invitation.

## Projects and boards

Projects, boards, and ordered columns are scoped to a workspace. Every route
checks the workspace membership before loading the requested project or board.

## Tasks

Tasks belong to a board column and support priorities, due dates, ordering,
archiving, and assignment to workspace members. Task routes validate the full
workspace → project → board chain before reading or writing data.

## Email

Email delivery is behind `EmailService` and the `EmailProvider` interface. Set
`EMAIL_PROVIDER=smtp` for Mailpit or another SMTP server, or
`EMAIL_PROVIDER=gmail` with `EMAIL_USER` and `EMAIL_APP_PASSWORD` for Gmail via
Nodemailer. Delivery failures are logged and returned as `{ sent: false }` so
invitation and recovery flows can handle provider outages without coupling to a
specific vendor.

## API quality and security

- Helmet applies secure HTTP response headers.
- Global validation strips unknown request fields and transforms DTO values.
- A global throttler limits requests to 100 per minute per client.
- JSON request bodies are limited to 1 MB.
- CORS is restricted to the origins listed in `CORS_ORIGINS`.

