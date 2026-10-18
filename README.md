# Open Issue Tracker (jira-clone)

An open-source, self-hostable project/issue tracker inspired by Jira. React
(Vite + TypeScript + Tailwind) frontend, Node.js/Express + TypeScript backend,
PostgreSQL via Prisma. Built to be forked and extended, and to be deployed by
anyone on their own server via Docker Compose — including server-admin
configurable branding and SMTP, without touching code.

## Features implemented in this pass

- **Auth**: register/login with JWT, bcrypt password hashing, system roles
  (ADMIN / MEMBER). The first registered user on a fresh instance is
  automatically promoted to ADMIN.
- **Projects**: create (auto-generated or custom short key, e.g. `PROJ`),
  list, view, update, delete; per-project membership with roles
  (ADMIN / MEMBER / VIEWER).
- **Issues**: full CRUD. Types (Epic/Story/Task/Bug/Subtask), status, priority,
  assignee, reporter, labels, parent/child relationships, story points, due
  dates, comments, issue links (Blocks / Relates to / Duplicates), and an
  auto-recorded activity log (status/assignee/priority/title changes).
- **Kanban board**: per-project board with To Do / In Progress / In Review /
  Done columns, drag-and-drop (via `@dnd-kit`) to reorder within a column or
  move between columns (optimistic UI + API call, with rollback on failure),
  and a filter bar (assignee, label, type, free-text search).
- **Notifications**: in-app notification records created on assignment,
  comment-added, @mention (simple `@username`/`@local-part` regex match
  against project members), and status change. Email sending is fully
  optional — if SMTP isn't configured, email is silently skipped and the
  in-app notification is still recorded.
- **Branding**: `GET /api/branding` is public (so the login page can render
  custom branding before sign-in); `PUT /api/admin/branding` is admin-only.
  The client's `ThemeProvider` applies colors as CSS custom properties, and
  sets `document.title` and the favicon.
- **SMTP settings**: configurable via bootstrap environment variables AND an
  in-app Admin Settings screen backed by the database. **Database settings
  override environment defaults** — env vars are the first-boot fallback.
  Includes a "Send test email" button.
- **Seed script**: creates an admin user, a sample project with issues across
  every status, default branding, and an empty SMTP settings row.

## Not yet implemented / Roadmap

These are explicitly out of scope for this pass, to keep it a genuinely
working foundation rather than a sprawling half-built app. Clear next steps:

- Sprints & backlog (separate from the single always-on board)
- Burndown / velocity charts and other agile reporting
- Custom workflow editor (configurable statuses/transitions per project)
- JQL-like advanced search / saved filters
- Public REST API documentation and webhooks for third-party integrations
- OAuth / SSO (Google, GitHub, SAML, OIDC)
- Rich text / WYSIWYG issue descriptions (currently plain text; Markdown-ready)
- File attachments on issues/comments
- Real-time updates (websockets) — the board currently relies on
  request/response + optimistic updates, not live push
- Fine-grained per-field permissions beyond project roles

## Architecture overview

```
packages/server   Express + TypeScript API, Prisma ORM, PostgreSQL
packages/client    React + Vite + TypeScript + Tailwind SPA
```

- **Branding & SMTP resolution** (`packages/server/src/config/settings.ts`):
  a singleton `BrandingSettings` row and a singleton `SmtpSettings` row in
  Postgres. SMTP resolution merges the DB row over environment variables
  field-by-field, so a partially-filled DB row still falls back sensibly.
  Email sending becomes a no-op (logged, not thrown) if no host resolves.
- **Auth**: JWT bearer tokens, verified in `middleware/auth.ts`. Project-level
  permissions are enforced in `middleware/projectAccess.ts`, which loads the
  caller's `ProjectMember` row (system ADMINs get implicit project ADMIN
  access everywhere).
- **Extension points**: each domain lives in its own `modules/<name>` folder
  with routes + a thin service layer, so adding (for example) a sprints
  module means adding a new folder and mounting its router in
  `src/index.ts`, without touching existing modules.

## Local development

Prerequisites: Node.js 20+, npm 10+, Docker (for Postgres; optional for the
rest), and a Postgres instance if you don't want to use Docker.

```bash
# 1. Install all workspace dependencies
npm install

# 2. Start Postgres only (dev override) — or run your own Postgres instance
docker compose -f docker-compose.dev.yml up -d

# 3. Configure environment variables
cp packages/server/.env.example packages/server/.env
cp packages/client/.env.example packages/client/.env
# Edit packages/server/.env if your DB credentials differ from the defaults.

# 4. Run migrations and seed the database
npm run prisma:migrate --workspace=packages/server
npm run prisma:seed --workspace=packages/server

# 5. Run both apps in dev mode (server on :4000, client on :5173 with HMR)
npm run dev
```

Then open http://localhost:5173 and sign in with the seeded admin credentials
below (or register a new account — the first registered user on a database
with no users becomes an admin automatically).

### Useful scripts

| Command                                   | What it does                                  |
| ------------------------------------------ | ---------------------------------------------- |
| `npm run dev`                              | Run server + client in watch mode               |
| `npm run build`                            | Type-check and build both packages              |
| `npm run typecheck`                        | `tsc --noEmit` for both packages                |
| `npm run lint`                             | ESLint for both packages                        |
| `npm run prisma:migrate --workspace=...`   | Create/apply a dev migration                    |
| `npm run prisma:seed --workspace=...`      | Re-run the (idempotent) seed script             |

## Production self-hosting (Docker Compose)

```bash
cp .env.example .env
# Edit .env: set strong POSTGRES_PASSWORD, JWT_SECRET (e.g. `openssl rand -hex 32`),
# CORS_ORIGIN (your public URL), ADMIN_EMAIL/ADMIN_PASSWORD, and optionally SMTP_*.

docker compose up -d --build
```

This starts three containers:

- `postgres` — PostgreSQL with a named volume (`postgres_data`) for durable storage.
- `server` — the Express API. On startup its entrypoint runs
  `prisma migrate deploy` (applies pending migrations) and the seed script
  (idempotent — safe to run on every boot) before starting the server.
- `client` — the built React app served by nginx, with `/api` reverse-proxied
  to the `server` container.

The client is reachable at `http://<your-server>:8080` by default (see
`docker-compose.yml` to change the published port or put it behind your own
reverse proxy/TLS termination).

### Admin login

On first boot, the seed script creates an admin account using
`ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env` file (defaults to
`admin@example.com` / `ChangeMe123!` if left unset).

**Change this password immediately after your first login** — there is no
forced password-rotation flow in this MVP, so treat the default credentials
as a known, public secret until you change them.

## Customizing branding/theme

Two ways, both ending up in the same `BrandingSettings` database row:

1. **In-app (recommended for most deployments)**: log in as an admin, go to
   **Admin Settings → Branding**, and set product name, logo URL, favicon URL,
   primary color, and accent color. Changes apply immediately (the client
   re-fetches `/api/branding` and updates CSS variables, page title, and
   favicon without a rebuild).
2. **Fully automated deploys**: edit `packages/server/prisma/seed.ts`'s
   `brandingSettings.upsert` call (or call `PUT /api/admin/branding` from your
   own provisioning script after boot) to set branding as part of your deploy
   pipeline, with no manual UI step.

The branding endpoint (`GET /api/branding`) is public and unauthenticated by
design, so the login page itself can show your logo and colors before anyone
signs in.

## Configuring SMTP

Same two paths as branding:

1. **Bootstrap via environment variables** (`SMTP_HOST`, `SMTP_PORT`,
   `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` in your `.env`).
   These are used whenever no database row (or an incomplete one) has been
   configured yet.
2. **In-app, at any time**: **Admin Settings → SMTP**. Values saved here are
   stored in the `SmtpSettings` table and take precedence over the
   environment variables, field by field (an empty field in the DB falls back
   to the env value). Use **Send test email** to confirm delivery — it sends
   a test message to the logged-in admin's own address and reports success or
   failure inline.

If SMTP is never configured (no env vars, no DB row), the app keeps working
normally: in-app notifications are still recorded, and email sends are
skipped with a logged reason rather than failing the request.

> **Security note**: `SmtpSettings.password` is stored as plaintext in this
> MVP, isolated behind an admin-only API. Before storing real production SMTP
> credentials, add application-level encryption at rest (e.g. envelope
> encryption with a KMS-held key, or a secrets manager) — this is called out
> as a `TODO` in `packages/server/prisma/schema.prisma`.

## Security notes

- Passwords are always bcrypt-hashed (never stored or logged in plaintext).
- All database access goes through Prisma's parameterized query builder —
  no raw string-interpolated SQL anywhere in the codebase.
- `JWT_SECRET` must be set in production; the server fails fast at boot if
  `NODE_ENV=production` and `JWT_SECRET` is unset, rather than silently
  falling back to an insecure default.
- Project-level authorization is enforced server-side on every
  project/issue/comment/label route, not just hidden in the UI.

## License

No license file has been added yet — add one (e.g. MIT or Apache-2.0) before
distributing this project publicly.
