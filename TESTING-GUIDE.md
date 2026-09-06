# TaskFlow — Complete Testing Guide

End-to-end manual test plan for the TaskFlow backend. Follow top-down with
**Postman** (`TaskFlow.postman_collection.json`) or any HTTP client.
Set `baseUrl = http://localhost:5000` (or your live API URL).

> Reset anytime: re-run `npm run db:seed` (idempotent upserts — restores demo
> users/passwords and the demo org/project). Always re-login after a reset.

## 0. Setup & ground rules

```bash
npm install
cp .env.example .env        # fill real values (DB, JWT, Redis, SMTP, bKash, Cloudinary, Google)
npm run db:seed             # fresh demo data (must run once; safe to re-run)
npm run dev                 # http://localhost:5000
```

**Response contract** — every endpoint returns one of:

```json
// success
{ "success": true, "statusCode": 200, "message": "Operation successful", "data": {} }
// error
{ "success": false, "statusCode": 400, "message": "Something went wrong", "errors": [] }
```

List endpoints add `meta: { page, limit, total, totalPages }`.
Auth = `Authorization: Bearer <accessToken>` header (httpOnly cookies also work).

**Demo credentials (seeded):**

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@gmail.com` | `Super@admin12345` |
| Org Owner | `owner@demo.com` | `Owner@123` |
| Member | `alice@demo.com` / `bob@demo.com` | `Member@123` |

Seeded org `demo-org` (PRO plan) with 1 project, 1 active sprint, 5 tasks.

**Rate limits (don't spam):** auth endpoints 20 req/15 min, payment endpoints
10 req/15 min. If you hit `429`, wait before continuing.

---

## 1. Health & 404

| # | Request | Expect |
|---|---|---|
| 1.1 | `GET /health` | `200`, `{ success:true, data:{ uptime } }` |
| 1.2 | `GET /nope` | `404`, `{ success:false }` |

## 2. Auth — all 3 roles + token lifecycle

| # | Request | Expect |
|---|---|---|
| 2.1 | `POST /api/v1/auth/login` owner (`owner@demo.com`/`Owner@123`) | `200`, save `accessToken` |
| 2.2 | `POST /api/v1/auth/login` member (`alice@demo.com`/`Member@123`) | `200`, save as `memberToken` |
| 2.3 | `POST /api/v1/auth/login` admin (`superadmin@gmail.com`/`Super@admin12345`) | `200`, `user.platformRole = SUPER_ADMIN`, save as `adminToken` |
| 2.4 | `POST /api/v1/auth/login` wrong password | `401`, `{ success:false }` |
| 2.5 | `POST /api/v1/auth/register` bad body (`{"name":"A","email":"bad","password":"weak"}`) | `400` validation error with `errors[]` |
| 2.6 | `POST /api/v1/auth/register` new user → check inbox for OTP → `POST /api/v1/auth/verify-email` | `201` then verified login tokens |
| 2.7 | `POST /api/v1/auth/resend-otp` | `200` (new OTP mailed) |
| 2.8 | `GET /api/v1/auth/me` with owner token | `200`, own profile |
| 2.9 | `GET /api/v1/users/me` **without** token | `401` |
| 2.10 | `POST /api/v1/auth/refresh-token` (with refresh cookie) | `200`, rotated tokens |
| 2.11 | `POST /api/v1/auth/change-password` (owner) | `200`; old password stops working |
| 2.12 | `POST /api/v1/auth/forgot-password` → OTP → `POST /api/v1/auth/reset-password` | `200`, login with new password |
| 2.13 | `POST /api/v1/auth/logout` | `200`, cookies cleared |
| 2.14 | `POST /api/v1/auth/google` with real Google `idToken` | `200` (needs `GOOGLE_CLIENT_ID`) |

> If you changed the owner password in 2.11/2.12, re-run `npm run db:seed`
> and re-login before continuing — later phases assume default passwords.

## 3. Users

| # | Request | Expect |
|---|---|---|
| 3.1 | `GET /api/v1/users/me` (owner) | `200` |
| 3.2 | `PATCH /api/v1/users/me` `{"name":"Demo Owner"}` | `200`, name updated |

## 4. Organizations & invites (owner-only vs member)

| # | Request | Expect |
|---|---|---|
| 4.1 | `POST /api/v1/organizations` `{"name":"Acme Inc"}` (owner) | `201`, save `organizationId` (FREE plan auto-created) |
| 4.2 | `GET /api/v1/organizations` | `200`, lists own orgs |
| 4.3 | `GET /api/v1/organizations/:id` | `200` |
| 4.4 | `PATCH /api/v1/organizations/:id` `{"name":"Acme Inc Updated"}` (owner) | `200` |
| 4.5 | `POST /api/v1/organizations/:id/invite` `{"email":"bob@demo.com"}` (owner) | `201`, save `inviteToken` |
| 4.6 | Same invite with **memberToken** | `403` (members can't invite) |
| 4.7 | `POST /api/v1/organizations/invitations/accept` `{"token":"..."} ` (as bob) | `200`, bob joins |
| 4.8 | `GET /api/v1/organizations/:id/members` | `200`, paginated |
| 4.9 | `PATCH /api/v1/organizations/:id/members/:userId` `{"role":"MEMBER"}` (owner) | `200` |
| 4.10 | `DELETE /api/v1/organizations/:id/members/:userId` (owner) | `200` (soft remove) |

## 5. Teams

| # | Request | Expect |
|---|---|---|
| 5.1 | `POST /api/v1/organizations/:id/teams` `{"name":"Backend"}` | `201`, save `teamId` |
| 5.2 | `GET .../teams` / `GET .../teams/:teamId` | `200` |
| 5.3 | `PATCH .../teams/:teamId` `{"name":"Backend V2"}` | `200` |
| 5.4 | `POST .../teams/:teamId/members` `{"userId":"<memberId>"}` | `201` |
| 5.5 | `GET .../teams/:teamId/members` | `200` |
| 5.6 | `DELETE .../teams/:teamId/members/:userId` then `DELETE .../teams/:teamId` | `200` (soft delete) |

## 6. Projects (plan limits enforced in transaction)

| # | Request | Expect |
|---|---|---|
| 6.1 | `POST /api/v1/organizations/:id/projects` `{"name":"Website","teamId":"..."}` | `201`, save `projectId` |
| 6.2 | `GET .../projects?status=ACTIVE&sortBy=name&sortOrder=asc` | `200` + `meta` (filter/sort) |
| 6.3 | `GET .../projects/:projectId` / `PATCH` description | `200` |
| 6.4 | `POST .../projects/:projectId/members` `{"userId":"..."}` → `GET` members → `DELETE` member | `201` / `200` / `200` |
| 6.5 | Create projects until FREE plan `maxProjects` exceeded | `403` plan-limit error |
| 6.6 | `DELETE .../projects/:projectId` (owner) | `200`, cascades soft-delete sprints→tasks→subtasks |

## 7. Sprints (single-active enforced)

| # | Request | Expect |
|---|---|---|
| 7.1 | `POST .../projects/:projectId/sprints` `{"name":"Sprint 1","startDate":"...","endDate":"..."}` | `201`, save `sprintId` |
| 7.2 | `GET .../sprints` / `GET .../sprints/:sprintId` / `PATCH` name | `200` |
| 7.3 | `POST .../sprints/:sprintId/activate` (owner) | `200`, status `ACTIVE` |
| 7.4 | Activate a second sprint in same project | `200`, first sprint auto-completed (only one ACTIVE) |
| 7.5 | `POST .../sprints/:sprintId/complete` (owner) | `200`, status `COMPLETED` |
| 7.6 | Activate as **member** | `403` (owner-only) |

## 8. Tasks — full lifecycle

| # | Request | Expect |
|---|---|---|
| 8.1 | `POST .../projects/:projectId/tasks` `{"title":"Build API","priority":"HIGH"}` | `201`, save `taskId` |
| 8.2 | `GET .../tasks?page=1&limit=10&status=TODO&q=API&sortBy=priority` | `200` + `meta` (pagination/filter/search/sort) |
| 8.3 | `GET .../tasks/my-assigned` (memberToken) | `200`, only own tasks |
| 8.4 | `GET .../tasks/:taskId` / `PATCH` `{"priority":"URGENT"}` | `200` |
| 8.5 | `PATCH .../tasks/:taskId/status` `{"status":"IN_PROGRESS"}` | `200` (`TODO→IN_PROGRESS→IN_REVIEW→DONE`) |
| 8.6 | `PATCH .../status` skipping ahead (`TODO→DONE`) | `400` transition error |
| 8.7 | `POST .../tasks/:taskId/assign` `{"userId":"..."}` | `200` |
| 8.8 | Subtasks: `POST` → `GET` → `PATCH {"isDone":true}` → `DELETE` | `201`/`200`/`200`/`200` |
| 8.9 | Comments: `POST {"content":"Nice work!"}` → `GET` (paginated) → `DELETE` | `201`/`200`/`200` |
| 8.10 | Attachments: `POST` multipart `file` (≤5 MB) → `GET` → `DELETE` | `201`/`200`/`200` (Cloudinary URL) |
| 8.11 | `DELETE .../tasks/:taskId` | `200` (soft delete + cascade) |

## 9. Dashboard (Redis cache)

| # | Request | Expect |
|---|---|---|
| 9.1 | `GET /api/v1/organizations/:id/dashboard` 1st call | `200`, header `X-Cache: MISS` |
| 9.2 | Same request immediately | `200`, header `X-Cache: HIT` |

## 10. Payments — bKash sandbox (owner only)

| # | Request | Expect |
|---|---|---|
| 10.1 | `POST /api/v1/payments/initiate` `{"organizationId":"...","plan":"PRO"}` (owner) | `200`, `data.payment.id` + `data.bkashURL` |
| 10.2 | Open `bkashURL`, pay with sandbox wallet | bKash success page |
| 10.3 | `GET /api/v1/payments/callback?paymentID=...&status=success` | `200`, payment `SUCCESS` |
| 10.4 | `POST /api/v1/payments/execute` `{"paymentID":"..."}` | `200` (idempotent — repeat = "already processed") |
| 10.5 | `GET /api/v1/payments/:id` | `200`, status + `trxID` |
| 10.6 | `GET /api/v1/organizations/:id/subscription` | `200`, plan upgraded `PRO`, `currentPeriodEnd` +30d |
| 10.7 | Initiate as **member** | `403` |

## 11. Admin (super admin only)

| # | Request | Expect |
|---|---|---|
| 11.1 | `GET /api/v1/admin/organizations?status=ACTIVE` (adminToken) | `200` |
| 11.2 | `PATCH /api/v1/admin/organizations/:id/status` `{"status":"SUSPENDED"}` | `200` (+ audit log) |
| 11.3 | `GET /api/v1/admin/users?search=demo` | `200` (search/filter) |
| 11.4 | `PATCH /api/v1/admin/users/:id/status` `{"isActive":false}` | `200`; blocked user login → `401` |
| 11.5 | `GET /api/v1/admin/dashboard-stats` | `200`, platform totals |
| 11.6 | `GET /api/v1/admin/audit-logs?action=PAYMENT_SUCCESS` | `200`, filtered logs |
| 11.7 | Any `/admin/*` with **owner** token | `403` |

## 12. Role-access matrix (must all hold)

| Endpoint | Owner | Member | Super Admin |
|---|---|---|---|
| `POST /organizations/:id/invite` | ✅ | ❌ 403 | — |
| `DELETE /projects/:id`, sprint activate/complete | ✅ | ❌ 403 | — |
| `POST /payments/initiate` | ✅ | ❌ 403 | — |
| `GET /admin/*` | ❌ 403 | ❌ 403 | ✅ |
| Task CRUD / comments / status | ✅ | ✅ | — |
| No token anywhere protected | ❌ 401 | ❌ 401 | ❌ 401 |

## 13. Done checklist

- [ ] Health + 404 (§1)
- [ ] 3-role login + register/OTP/refresh/logout/password flows (§2)
- [ ] Users (§3), Orgs + invite 403 (§4)
- [ ] Teams (§5), Projects + plan limit (§6), Sprints single-active (§7)
- [ ] Task lifecycle incl. status-machine 400, search/filter/sort/meta (§8)
- [ ] Dashboard `X-Cache: MISS → HIT` (§9)
- [ ] bKash initiate → pay → callback/execute → subscription upgraded (§10)
- [ ] Admin CRUD + audit logs + owner 403 (§11–12)
- [ ] Every error matches `{ success:false, statusCode, message, errors[] }`
