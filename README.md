# TaskFlow — Project Management SaaS Backend

Multi-tenant Project Management SaaS API: organizations, teams, projects, sprints, tasks (subtasks, comments, Cloudinary attachments), bKash subscription payments, Redis caching + rate limiting, and super-admin operations.

Stack: Node.js + TypeScript + Express 5, PostgreSQL + Prisma 7, Zod, JWT (cookie + Bearer), Google OAuth login, Redis, Nodemailer (EJS templates), Multer + Cloudinary, bKash tokenized checkout (sandbox), express-rate-limit with Redis store.

## Demo credentials (seeded)

| Role | Email | Password |
|---|---|---|
| Super Admin | superadmin@gmail.com | Super@admin12345 |
| Org Owner | owner@demo.com | Owner@123 |
| Member | alice@demo.com / bob@demo.com | Member@123 |

Seeded org: `demo-org` (PRO plan) with a demo project, sprint and tasks. Values come from `.env` (`SUPER_ADMIN_*`); demo users are created by `prisma/seed.ts`.

## Setup

Prerequisites: Node.js 20+, a PostgreSQL database, a Redis instance.

```bash
npm install
cp .env.example .env   # then fill in real values
npx prisma generate --config prisma7.config.ts
npx prisma db push --config prisma7.config.ts
npm run db:seed
npm run dev            # http://localhost:5000
```

Production:

```bash
npm run build
npm start              # serves dist/, needs DATABASE_URL, JWT_*, Redis, etc.
```

Scripts: `dev` (tsx watch), `build` (tsc + copy email templates), `start`, `db:seed`, `db:studio`, `format:check`, `lint:check`.

## API overview (`/api/v1`)

Auth: `POST /auth/register, /login, /google, /social-login, /verify-email, /resend-otp, /forgot-password, /reset-password, /refresh-token, /logout` · `GET /auth/me` · `POST /auth/change-password`

Users: `GET /users/me` · `PATCH /users/me`

Organizations: `POST /organizations` · `GET /organizations` · `GET/PATCH /organizations/:organizationId` · `POST /organizations/:organizationId/invite` · `POST /organizations/invitations/accept` · `GET/PATCH/DELETE /organizations/:organizationId/members[/:userId]` · `GET /organizations/:organizationId/subscription` · `GET /organizations/:organizationId/dashboard` (cached 60s, `X-Cache` header)

Teams: CRUD `/organizations/:organizationId/teams[/:teamId]` + `/members[/:userId]`

Projects: CRUD `/organizations/:organizationId/projects[/:projectId]` (plan-limit checked in transaction, cascade soft-delete) + `/members[/:userId]`

Sprints: CRUD `/organizations/:organizationId/projects/:projectId/sprints[/:sprintId]` + `/activate` + `/complete` (single active sprint per project, transactional)

Tasks: CRUD `/organizations/:organizationId/projects/:projectId/tasks[/:taskId]` with `?page&limit&status&priority&assigneeId&sprintId&sortBy&sortOrder&q` · `PATCH /status` (TODO → IN_PROGRESS → IN_REVIEW → DONE) · `POST /assign` · `GET /organizations/:organizationId/tasks/my-assigned` · subtasks, comments, attachments (`POST .../attachments` multipart `file`, max 5MB)

Payments (bKash sandbox): `POST /payments/initiate` (ORG_OWNER, rate-limited) → open `bkashURL` → `GET /payments/callback` → `POST /payments/execute` (idempotent) · `GET /payments/:id`

Admin (super admin only): `GET /admin/organizations?status` · `PATCH /admin/organizations/:id/status` · `GET /admin/users?search&platformRole&isActive` · `PATCH /admin/users/:id/status` · `GET /admin/dashboard-stats` · `GET /admin/audit-logs?action&userId&from&to`

Response format — success: `{ success: true, statusCode, message, data, meta? }`, error: `{ success: false, statusCode, message, errors: [{ path, message }] }`. Auth via `Authorization: Bearer <accessToken>` or httpOnly cookies. See `TaskFlow.postman_collection.json` for a full request collection.

## Roles

- `SUPER_ADMIN` (platform, `User.platformRole`) — `/admin/*`
- `ORG_OWNER` (per organization, `OrganizationMember.role`) — billing, invites, deletes, sprint activate/complete
- `MEMBER` (per organization) — create/update work, drive task status, comment

Enforced by `authenticate`, `requireOrgMembership`, `requireRole`, `requireSuperAdmin` middlewares.

## Deployment

Deployable to Render (see `render.yaml`) or Vercel (see `vercel.json`). Set production env vars: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_*`, `SMTP_*`, `GOOGLE_CLIENT_ID`, `CLOUDINARY_*`, `BKASH_*` (sandbox), `BKASH_CALLBACK_URL` (public callback URL), `FRONTEND_URL`, `SUPER_ADMIN_*`, then run seed once for the demo admin.

## Project structure

```
src/
  app.ts server.ts
  app/
    config/ lib/ (prisma, redis, cache, bkash, googleAuth, nodemailer, cloudinary)
    middleware/ (auth, validateRequest, rateLimit, upload, globalErrorHandler, notFound)
    modules/ (auth, user, organization, team, project, sprint, task, dashboard, payment, admin)
    routes/ templates/ utils/ interfaces/
prisma/schema/ (15 models) seed.ts
```
