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
- **Kanban board**: per-project board whose columns come from that project's
  own configurable workflow (see below), drag-and-drop (via `@dnd-kit`) to
  reorder within a column or move between columns (optimistic UI + API call,
  with rollback and a toast explaining why on failure), a filter bar
  (assignee, label, type, free-text search behind a compact "Filter" popover),
  and an overlapping avatar-stack quick filter (click an avatar to toggle it
  into a multi-select OR filter; composes with the detailed filters via AND).
  Each column shows a "+" to create an issue directly into that status, and a
  collapse toggle that shrinks it to a thin labeled strip.
- **WIP limits**: an optional per-status limit (project Settings → Workflow),
  shown on the board as a "count/limit" badge that turns red when exceeded.
  Purely advisory — like Jira, exceeding it never blocks a drag-and-drop move,
  it's just an unmistakable visual nudge.
- **Swimlanes (group-by)**: group the board by Assignee or Epic into
  collapsible swimlane rows, each showing the same status columns filtered to
  that lane. An issue belongs to an epic's lane only when its direct parent is
  itself type EPIC (anything else — no parent, or a non-epic parent — falls
  into "No epic"); dragging a card into a different lane also reassigns that
  grouping field (assignee or parent epic), on top of any status change.
- **Customizable workflows**: each project defines its own ordered list of
  statuses (name, color, and a `category` of `TODO` / `IN_PROGRESS` / `DONE`)
  instead of a fixed enum — add, rename, recolor, reorder, and set the
  default status from the project's Settings page (gear icon on the board
  header; project-admin only). A status with existing issues, or the current
  default, can't be deleted (409). Burndown charts and "is this sprint
  issue done" logic key off a status's **category**, never its name, so
  renaming or adding statuses never breaks those computations. Optional
  per-project **transition rules** restrict which status-to-status moves are
  allowed; with zero rules defined (the default for every project, old and
  new) any status can move to any other, exactly like before — the moment
  one rule exists, only the defined `(from -> to)` pairs (plus a no-op move
  to the same status) are allowed, and an invalid board drag is rejected
  with a 400 and rolls back on the client with an explanatory toast.
- **Notifications**: in-app notification records created on assignment,
  comment-added, @mention (simple `@username`/`@local-part` regex match
  against project members), and status change. Email sending is fully
  optional — if SMTP isn't configured, email is silently skipped and the
  in-app notification is still recorded.
- **Branding**: `GET /api/branding` is public (so the login page can render
  custom branding before sign-in); `PUT /api/admin/branding` is admin-only.
  The client's `ThemeProvider` applies colors as CSS custom properties, and
  sets `document.title` and the favicon.
- **UI**: built on [shadcn/ui](https://ui.shadcn.com) (Radix UI primitives +
  Tailwind CSS) — every interactive element (buttons, forms, selects,
  dialogs, tables, tabs, toasts, the issue due-date picker, the searchable
  assignee/member pickers) is a shadcn component under
  `packages/client/src/components/ui`. Admin-configured branding colors
  propagate to shadcn's theme tokens automatically: `ThemeProvider` converts
  the admin's primary/accent hex colors to HSL and sets them as shadcn's
  `--primary`/`--accent`/`--ring` CSS variables at runtime, so changing
  branding re-themes shadcn components too, with no redeploy needed.
- **SMTP settings**: configurable via bootstrap environment variables AND an
  in-app Admin Settings screen backed by the database. **Database settings
  override environment defaults** — env vars are the first-boot fallback.
  Includes a "Send test email" button.
- **Seed script**: creates an admin user, a sample project with issues across
  every status, default branding, and an empty SMTP settings row.
- **Backlog & sprints**: a `/projects/:id/backlog` view, separate from the
  always-on kanban board, with drag-and-drop (via `@dnd-kit`) to move issues
  between sprints and the backlog and to reorder the backlog. Sprints move
  PLANNED → ACTIVE → COMPLETED; starting one sets a planned end date from a
  chosen duration (default 14 days), and completing one moves any
  not-Done issues to the backlog or another planned sprint, your choice.
  Simplified by design: only one ACTIVE sprint per project (enforced at the
  application level, not the schema), and there's no custom sprint-internal
  issue ordering (that field is reserved for the kanban board).
- **List & Calendar views**: `/projects/:id/list` is a sortable table (key,
  type, title, status, assignee, priority, labels, due date, points) of every
  issue in the project; `/projects/:id/calendar` is a month grid (built on
  `date-fns`, no extra calendar library) showing issues on their due date,
  with a "No due date" side panel for the rest. Both reuse the same
  `IssueDetailModal` as the board/backlog for clicking into an issue. A tab
  bar (Board / Backlog / List / Calendar) sits above all four views.
  Board group-by, and both board/swimlane collapsed-state, are **per-browser**
  (`localStorage`), not account state — same reasoning as "Recent" below:
  nobody needs their board layout to follow them to another device, so it's
  a client-only convenience rather than a schema/endpoint.
- **Burndown chart**: `GET /api/sprints/:id/burndown` and an inline hand-rolled
  SVG chart (no charting library) on the active sprint's backlog section.
  Computed on demand from existing data (`Issue.storyPoints`, `createdAt`, and
  `ActivityLog` entries) rather than a pre-aggregated snapshot table — simpler
  at the cost of recomputing the series per request, which is cheap at this
  scale. Issues with no story points count as 0 toward the total.
- **Reports: velocity + cumulative flow diagram** (`/projects/:id/reports`,
  added to the Board/Backlog/List/Calendar tab bar): two more hand-rolled SVG
  charts, same on-demand-from-existing-data philosophy as burndown — no
  snapshot tables, no charting library.
  - **Velocity** (`GET /api/projects/:id/reports/velocity`): committed vs.
    completed story points for every COMPLETED sprint, oldest first, plus an
    average-velocity reference line over the last 5 sprints. "Committed" is
    every issue ever assigned to the sprint (reconstructed from the `sprint`
    ActivityLog field, since completing a sprint moves any not-done issue
    elsewhere — see below); "completed" is the committed set filtered to
    issues whose DONE-category status was reached at or before the sprint's
    `completedAt`. The sprint-membership/completion-timeline replay this
    needs is the same one burndown uses, factored out as
    `reconstructIssueSprintTimelines` (`sprints.service.ts`) so the two
    features share one ActivityLog replay instead of two that could drift.
  - **Cumulative flow diagram** (`GET /api/projects/:id/reports/cfd?from=&to=`,
    default range: last 30 days, or the project's full history if shorter):
    for each day, the count of issues in each status *category* (TODO /
    IN_PROGRESS / DONE, not individual status) as of end-of-day, reconstructed
    from `Issue.createdAt` plus `ActivityLog` "status" entries. Categories,
    not statuses, keep the stacked chart legible against a project's
    admin-configurable workflow.
- **Navigation**: a persistent, collapsible left sidebar
  (`packages/client/src/components/layout/Sidebar.tsx` + `Layout.tsx`) is the
  app's only chrome on every authenticated page — it replaced the old top
  navbar. Rows: **For you** (new `/` home page — issues assigned to you
  across all your projects, `GET /api/issues/mine`), **Recent** (last ~8
  projects/issues you opened — client-side only, via `localStorage` keyed by
  user id, since it's a per-viewer convenience, not account state), **Starred**
  (backend-persisted `StarredProject` model + `/api/me/starred` and
  `/api/projects/:id/star`, so — unlike Recent — it follows your account
  across devices), **Projects** (mirrors Jira's "Spaces": a Recent sub-list
  plus an expandable "More projects"), **Filters**, **Activity**, **Workload**,
  **Teams**, and **Admin Settings**
  (admins only). Collapses to an icon-only rail (state persisted in
  `localStorage`) and falls back to a hamburger-triggered overlay on narrow
  viewports.
- **Global user & team management** (admin-only, `packages/server/src/modules/admin-users/`):
  org-wide user list with role changes, deactivate/reactivate, and a
  permanent-delete action; global Teams (simple membership, no per-team
  role) with a one-click "add all members to this project" bridge into
  per-project `ProjectMember`; and a self-serve email invite flow
  (`POST /api/admin/invites` → public `GET/POST /api/invites/:token`) that
  logs the invited user straight in on acceptance, with a copyable invite
  link shown in the admin UI when SMTP isn't configured. Two deliberate
  design choices: (1) deactivating a user (not hard-deleting) is the default
  removal path, since a hard delete would either be blocked by or
  cascade-destroy other users' issue/comment/activity history — deactivated
  users are blocked from login and hidden from assignee pickers, but their
  past issues/comments keep their name attached; permanent delete is only
  offered, and only succeeds, for a user with zero historical footprint.
  (2) the system enforces a single-active-admin invariant: demoting,
  deactivating, or deleting the last remaining ADMIN is rejected, so a
  self-hosted instance can never be locked out of its own admin area.
- **Rich text issue descriptions**: a focused [Tiptap](https://tiptap.dev)
  editor (bold/italic/strike, bullet/numbered lists, blockquote, code block,
  link) replaces the old plain-text description field, stored as Tiptap's
  document JSON (`Issue.descriptionJson`) rather than HTML/markdown — the
  client fully controls rendering, so there's no server-side HTML
  sanitization to get wrong. A derived plain-text `description` is kept in
  sync server-side on every save, for search/preview use.
- **Custom fields**: project admins define extra per-project issue fields
  (Text / Number / Date / Select / Checkbox, with a required toggle and
  drag-to-reorder) from the project Settings page; they render alongside the
  built-in Status/Assignee/Priority/Type fields on every issue in that
  project, including unset ones, and values are validated server-side
  against the field's type and (for Select) its options.
- **Attachments**: upload files to an issue (any project member), download,
  and delete (uploader or project admin). Stored on **local disk** by
  default (`UPLOAD_DIR`, default `./uploads`) under a generated UUID
  filename — never the original filename — with the original name/mime/size
  recorded only in the database. Downloads are always served as
  `application/octet-stream` with `Content-Disposition: attachment`
  regardless of the stored mime type, so a maliciously-named upload (e.g. an
  `.html`/`.svg` file) can never execute inline against this origin. Local
  disk is the simplest option for a single-container self-host; a deployment
  with multiple server replicas behind a load balancer would need shared or
  networked storage instead (e.g. NFS, S3) — out of scope for this pass.
- **JQL-like query language & saved filters**: a focused subset of Jira's
  query language, with its own hand-rolled tokenizer/parser/compiler
  (`packages/server/src/modules/filters/jql/`, no grammar-library
  dependency) that compiles straight to a Prisma `where` clause — no raw SQL
  string concatenation anywhere. A query input lives in the project List
  view (`Run`/inline error display, Jira-style, right under the field, not a
  toast), with a "Save filter" action and a dedicated **Filters** sidebar
  page for re-running, sharing, and deleting saved filters. See
  [Query language reference](#query-language-reference) below for the exact
  supported syntax. Like every other filter in this app, the compiler goes
  through Prisma's typed query builder exclusively — no user input is ever
  concatenated into a SQL string.
- **Workload view** (`/workload`, `GET /api/workload` + `/api/workload/me`):
  open (not-done) issue load per assignee, across projects or narrowed to one
  project/team, sorted by whoever has the most. Issue count is the primary
  bar metric (story points shown as secondary text) since most issues in
  practice have no story points set, making a points-only bar mostly empty.
  Access-scoped: the cross-user comparison is visible to a system ADMIN
  always, and to anyone else only for the projects where they hold the
  project-ADMIN role; everyone else still sees their own breakdown via the
  self-service `/me` endpoint, with a note that the fuller view needs
  project-admin access somewhere.
- **Global activity feed** (`/activity`, `GET /api/activity`): a
  reverse-chronological, cross-project, cross-issue stream of `ActivityLog`
  entries (status/assignee/sprint/etc. changes), grouped by day, with
  project/person filters and cursor-paginated "Load more". Access-scoped the
  same way as Home/"For you": every project the caller belongs to, or every
  project for a system ADMIN. Comments are not included — comment creation
  doesn't write an `ActivityLog` row, so this is field-change history only.
- **Outbound webhooks** (project Settings → Webhooks,
  `/api/projects/:projectId/webhooks`): project admins can register one or
  more external URLs to receive a signed HTTP POST whenever something
  happens in that project — issue created/updated/status-changed, a comment
  added, or a sprint started/completed. See
  [Webhooks: events and signature verification](#webhooks-events-and-signature-verification)
  below for the exact payload shape and how to verify a delivery is genuine.
  Dispatch is fire-and-forget (never blocks the request that triggered it),
  with a 10s timeout and one retry on failure, and every attempt is recorded
  to a per-webhook delivery log visible in the settings UI. The signing
  secret is shown in full only once, at creation time.
- **REST API reference** (`GET /api/docs`, `packages/server/openapi.yaml`):
  a complete OpenAPI 3.0 spec covering every mounted route — method, path,
  auth requirement, request/response shapes, error cases — served as
  interactive Swagger UI so self-hosters and integrators can discover and
  try the API without reading source. See
  [REST API documentation](#rest-api-documentation) below.

## REST API documentation

The full API surface is described in [`packages/server/openapi.yaml`](packages/server/openapi.yaml)
(OpenAPI 3.0), generated by hand directly from the route handlers under
`packages/server/src/modules/*/*.routes.ts` rather than written separately
from the code — every endpoint the server actually mounts is in there, not a
sample. Run the server and open **`http://localhost:4000/api/docs`** for an
interactive Swagger UI (try requests, inspect schemas) built from that same
file.

Authentication: almost every endpoint needs `Authorization: Bearer <token>`.
Get a token via `POST /api/auth/login` (or `POST /api/auth/register` for a
new account — the first account ever created on an instance becomes a
system ADMIN automatically). Tokens expire after `JWT_EXPIRES_IN` (1 day by
default); there is no refresh endpoint, so log in again once one expires.

### Webhooks: events and signature verification

A project webhook POSTs a JSON body shaped like this to its configured URL:

```json
{
  "event": "issue.statusChanged",
  "timestamp": "2026-10-19T12:00:00.000Z",
  "project": { "id": "...", "key": "DEMO", "name": "Demo Project" },
  "data": { "...": "event-specific payload, e.g. the updated issue" }
}
```

Supported `event` values: `issue.created`, `issue.updated`,
`issue.statusChanged`, `comment.created`, `sprint.started`,
`sprint.completed` — the fixed set of events this app's own code paths
actually raise (see `packages/server/src/modules/webhooks/events.ts`); there
is no wildcard subscription.

Every request carries an `X-Webhook-Signature` header: the hex-encoded
HMAC-SHA256 of the **exact raw request body bytes**, keyed by that
webhook's secret (shown in full only once, when the webhook is created).
Verify a delivery by recomputing that HMAC over the raw bytes you received
— not a re-serialization of the parsed JSON, since re-stringifying is not
guaranteed to reproduce the same key order/whitespace — and comparing it
(in constant time) to the header value. Example in Node.js:

```js
const crypto = require('crypto');
function isValid(rawBody, signatureHeader, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}
```

Delivery is fire-and-forget relative to the user request that triggered it
(a 10s timeout per attempt, one retry on failure — a full backoff/retry
queue was judged out of scope for this pass), and every attempt is logged
(event, response status, success, duration) to that webhook's delivery log,
viewable and manually re-triggerable ("Send test event") from project
Settings → Webhooks. A known limitation: the delivery log is not yet pruned,
so a very long-lived, high-traffic instance should add periodic cleanup.

## Query language reference

A deliberately small subset of Jira's JQL — enough to be genuinely useful
for a self-hosted tracker, not a reimplementation of Jira's full grammar.
Try it in a project's List view.

**Fields**: `project`, `status`, `statusCategory` (`TODO` / `IN_PROGRESS` /
`DONE`), `assignee`, `reporter`, `priority` (`Lowest`…`Highest`), `type`
(`Epic`/`Story`/`Task`/`Bug`/`Subtask`), `label`, `sprint`, `dueDate`,
`storyPoints`, `text` (free-text search over the issue title and the
plain-text fallback of its description), and custom fields via **`cf.<name>`**
— e.g. `cf.Severity` or, when the field's name has a space, `cf."Story Estimate"`.
This dot-notation syntax was chosen over Jira's numeric `cf[12345]` because
this app's custom fields are named, per-project, admin-defined fields, not
fixed numeric ids — `cf.<name>` stays both human-readable and unambiguous
against the fixed built-in fields above. A `cf.<name>` reference resolves
against whatever custom field definitions exist, by that name, in the
query's scope (see below); it isn't tied to any particular field type, so
the operator you use decides how the stored value is compared.

**Operators**: `=`, `!=`, `IN (a, b, …)`, `NOT IN (a, b, …)`, `IS EMPTY`,
`IS NOT EMPTY`; and, for dates and numbers (`dueDate`, `storyPoints`, and
`cf.<name>` custom fields holding numbers/dates), also `>`, `>=`, `<`, `<=`.
`text` only supports `=` (a case-insensitive "contains" match). Values are
either `"quoted strings"` or bare words (`status = Done`, `priority = High`)
— quoting is only required when a value contains a space.

**Boolean logic**: `AND`, `OR`, `NOT`, and parentheses for grouping, with the
usual precedence (`NOT` binds tightest, then `AND`, then `OR`).

**`currentUser()`**: a special value for `assignee`/`reporter` that resolves
to whoever is making the request, at query-execution time on the server —
never treated as a literal username, so a saved filter using it means
something different for each person who runs it.

**`ORDER BY <field> [ASC|DESC]`**: one field, ascending by default. Orderable
fields: `project`, `status`, `statusCategory`, `assignee`, `reporter`,
`priority`, `type`, `dueDate`, `storyPoints`, `createdAt`, `updatedAt`.
`label`, `sprint`, `text` and custom fields can be filtered on but not
sorted by.

**Scope — single project vs. cross-project**: `POST /api/projects/:projectId/query`
runs a query against one project (used by the List view's query bar).
`POST /api/issues/query` runs the same query language across every project
the caller belongs to (or every project, for a system ADMIN) — the same
access scope `GET /api/issues/mine` already uses — so a query like
`project IN (DEMO, OPS) AND assignee = currentUser()` can span projects the
way Jira's own cross-project JQL does. A saved filter with no project
(`projectId: null`) always runs in this cross-project scope.

**What's deliberately left out** (vs. real Jira JQL): functions other than
`currentUser()` (no `startOfWeek()`, `membersOf()`, etc.), relative/fuzzy
date values (no `-7d`), multi-field `ORDER BY`, and JQL's `~`/`!~` "text
contains" operators on arbitrary fields (only the dedicated `text` field
supports contains-matching). These are reasonable follow-ups, not technical
dead ends — the parser/compiler split makes extending the grammar isolated
to `packages/server/src/modules/filters/jql/`.

**Examples**

```
status = "Done"
assignee = currentUser() AND priority IN (High, Highest)
statusCategory != DONE ORDER BY priority DESC
cf.Severity = "High"
cf."Story Estimate" > 5
(status = "In Progress" OR status = "To Do") AND NOT label = blocked
project IN (DEMO, OPS) AND dueDate <= "2026-12-31"
```

## Not yet implemented / Roadmap

These are explicitly out of scope for this pass, to keep it a genuinely
working foundation rather than a sprawling half-built app. Clear next steps:

- OAuth / SSO (Google, GitHub, SAML, OIDC)
- Real-time updates (websockets) — the board currently relies on
  request/response + optimistic updates, not live push
- Fine-grained per-field permissions beyond project roles
- Custom dashboard widgets — the Reports page above ships two fixed charts
  (velocity, cumulative flow diagram), not a general configurable
  widget/dashboard builder; still not built

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
