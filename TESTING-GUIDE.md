# 🚀 TaskFlow — Step-by-Step Master Testing Guide

> 💡 **Welcome to the Step-by-Step Testing Guide for TaskFlow Backend.**  
> Follow this guide sequentially to test every module, real email notifications (OTP / Invitations), role-based permissions, payment processing, and error handling using **Postman** (`TaskFlow.postman_collection.json`) or Thunder Client.

---

## 🛠️ 0. Environment Setup & Seeded Credentials

Set environment base URL in Postman: `baseUrl = http://localhost:5000` (or your live API URL).

### 🔑 Verified Real Test Accounts (Seeded)

| Role | Email | Password | Purpose |
|:---|:---|:---|:---|
| **Super Admin** | `superadmin@gmail.com` | `Super@admin12345` | Platform administration, audit logs, system stats |
| **Org Owner** | `amran.xgroup@gmail.com` | `Owner@123` | Organization owner, billing/payments, member invites |
| **Member 1** | `mdamranhossen77@gmail.com` | `Member@123` | Active team collaborator, task assignee |
| **Member 2** | `firoz03dec@gmail.com` | `Member@123` | Active team collaborator |

> 📌 **Note:** `demo-org` is pre-configured with `amran.xgroup@gmail.com` as Owner, and `mdamranhossen77@gmail.com` + `firoz03dec@gmail.com` as active Members.

---

## 📥 STEP 1: Real Email & OTP Flow (Resend / SMTP Testing)

Test real email delivery directly to your inbox for OTP verification and password resets.

### 1.1 Register New Account & Receive Verification OTP
- **Endpoint:** `POST /api/v1/auth/register`
- **Request Body:**
  ```json
  {
    "name": "Amran Tester",
    "email": "mdamranhossen77@gmail.com",
    "password": "Password@123"
  }
  ```
- **Expect:** `201 Created` — Check your inbox (`mdamranhossen77@gmail.com`) for a 6-digit verification OTP.

### 1.2 Verify Email OTP
- **Endpoint:** `POST /api/v1/auth/verify-email`
- **Request Body:**
  ```json
  {
    "email": "mdamranhossen77@gmail.com",
    "otp": "123456" // Replace with actual 6-digit OTP received in email
  }
  ```
- **Expect:** `200 OK` — `"Email verified successfully"`.

### 1.3 Resend OTP (Rate Limited)
- **Endpoint:** `POST /api/v1/auth/resend-otp`
- **Request Body:** `{ "email": "mdamranhossen77@gmail.com" }`
- **Expect:** `200 OK` — New OTP sent to inbox.

### 1.4 Forgot Password & Reset Password Flow
- **Endpoint:** `POST /api/v1/auth/forgot-password`
- **Request Body:** `{ "email": "amran.xgroup@gmail.com" }`
- **Expect:** `200 OK` — Password reset OTP sent to `amran.xgroup@gmail.com`.
- **Endpoint:** `POST /api/v1/auth/reset-password`
- **Request Body:**
  ```json
  {
    "email": "amran.xgroup@gmail.com",
    "otp": "654321", // Replace with OTP from email
    "newPassword": "NewPassword@123"
  }
  ```
- **Expect:** `200 OK` — Password updated successfully.

---

## 🔐 STEP 2: Authentication & Session Tokens

### 2.1 User Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Request Body (Org Owner):**
  ```json
  {
    "email": "amran.xgroup@gmail.com",
    "password": "Owner@123"
  }
  ```
- **Expect:** `200 OK` — Returns `accessToken` & `refreshToken` in payload and sets `refreshToken` cookie.
- **Action:** Save `accessToken` in Postman collection variables for subsequent requests (`Authorization: Bearer <token>`).

### 2.2 Get Current Profile (`/me`)
- **Endpoint:** `GET /api/v1/auth/me`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Expect:** `200 OK` — Returns user profile details.

### 2.3 Refresh Access Token
- **Endpoint:** `POST /api/v1/auth/refresh-token`
- **Request Body:** `{ "refreshToken": "<refreshToken>" }`
- **Expect:** `200 OK` — Returns new `accessToken`.

---

## 🛡️ STEP 3: Role-Based Authorization (RBAC 403 Testing)

Verify strict 3-role permission boundaries (`SUPER_ADMIN`, `ORG_OWNER`, `MEMBER`).

### 3.1 Member Restricted Access (403 Forbidden Test)
1. Login as Member (`mdamranhossen77@gmail.com` / `Member@123`).
2. Attempt Admin route: `GET /api/v1/admin/organizations`.
3. **Expect:** `403 Forbidden` (`"Super Admin access required"`).

### 3.2 Member Billing Restriction (403 Forbidden Test)
1. Using Member token, attempt billing initiation: `POST /api/v1/payments/initiate`.
2. **Expect:** `403 Forbidden` (`"Only ORG_OWNER can manage billing"`).

### 3.3 Super Admin Authorized Access
1. Login as Super Admin (`superadmin@gmail.com` / `Super@admin12345`).
2. Access Admin route: `GET /api/v1/admin/dashboard-stats`.
3. **Expect:** `200 OK` — Returns platform-wide statistics.

---

## 🏢 STEP 4: Organization & Member Management

### 4.1 Create New Organization
- **Endpoint:** `POST /api/v1/organizations`
- **Headers:** `Authorization: Bearer <OrgOwnerToken>`
- **Request Body:** `{ "name": "TaskFlow Solutions", "slug": "taskflow-solutions" }`
- **Expect:** `201 Created` — Automatically sets creator as `ORG_OWNER` with `FREE` plan.

### 4.2 Invite Member by Email
- **Endpoint:** `POST /api/v1/organizations/:organizationId/invite`
- **Request Body:** `{ "email": "firoz03dec@gmail.com", "role": "MEMBER" }`
- **Expect:** `200 OK` — Invitation email sent to `firoz03dec@gmail.com` with invitation token.

### 4.3 Accept Invitation
- **Endpoint:** `POST /api/v1/organizations/invitations/accept`
- **Headers:** `Authorization: Bearer <FirozToken>`
- **Request Body:** `{ "token": "<invitation_token>" }`
- **Expect:** `200 OK` — Member joined organization.

---

## 📂 STEP 5: Projects & Plan Limit Enforcement

### 5.1 Create Project
- **Endpoint:** `POST /api/v1/organizations/:organizationId/projects`
- **Request Body:** `{ "name": "Mobile App V2", "description": "React Native SaaS App" }`
- **Expect:** `201 Created`.

### 5.2 List Projects (Search & Pagination)
- **Endpoint:** `GET /api/v1/organizations/:organizationId/projects?page=1&limit=10&q=Mobile`
- **Expect:** `200 OK` with paginated `data` and `meta`.

### 5.3 Soft Delete Project
- **Endpoint:** `DELETE /api/v1/organizations/:organizationId/projects/:projectId`
- **Expect:** `200 OK` — Project status updated with `deletedAt`.

---

## ⚡ STEP 6: Sprint Cycles (Single Active Sprint Rule)

### 6.1 Create Sprint
- **Endpoint:** `POST /api/v1/organizations/:organizationId/projects/:projectId/sprints`
- **Request Body:** `{ "name": "Sprint 1", "startDate": "2026-09-01T00:00:00Z", "endDate": "2026-09-14T00:00:00Z" }`
- **Expect:** `201 Created` (`status: PLANNED`).

### 6.2 Activate Sprint (Transaction Enforced)
- **Endpoint:** `POST /api/v1/organizations/:organizationId/projects/:projectId/sprints/:sprintId/activate`
- **Expect:** `200 OK` — Ensures no other sprint is active simultaneously in the project.

### 6.3 Complete Sprint
- **Endpoint:** `POST /api/v1/organizations/:organizationId/projects/:projectId/sprints/:sprintId/complete`
- **Expect:** `200 OK` — Marks sprint as `COMPLETED`.

---

## 📋 STEP 7: Tasks, Subtasks, Comments & File Attachments

### 7.1 Create Task
- **Endpoint:** `POST /api/v1/organizations/:organizationId/projects/:projectId/tasks`
- **Request Body:**
  ```json
  {
    "title": "Build Auth Middleware",
    "description": "Implement JWT and Role check",
    "priority": "HIGH",
    "status": "TODO"
  }
  ```
- **Expect:** `201 Created`.

### 7.2 Update Task Status Workflow
- **Endpoint:** `PATCH /api/v1/organizations/:organizationId/projects/:projectId/tasks/:taskId/status`
- **Request Body:** `{ "status": "IN_PROGRESS" }`
- **Expect:** `200 OK` — Status updated (`TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE`).

### 7.3 Assign Task to Member
- **Endpoint:** `POST /api/v1/organizations/:organizationId/projects/:projectId/tasks/:taskId/assign`
- **Request Body:** `{ "assigneeId": "<member_user_id>" }`
- **Expect:** `200 OK`.

### 7.4 Add Comment
- **Endpoint:** `POST /api/v1/organizations/:organizationId/projects/:projectId/tasks/:taskId/comments`
- **Request Body:** `{ "content": "PR is ready for review." }`
- **Expect:** `201 Created`.

### 7.5 Upload File Attachment (Cloudinary Integration)
- **Endpoint:** `POST /api/v1/organizations/:organizationId/projects/:projectId/tasks/:taskId/attachments`
- **Form Data:** Key `file` (Select image/PDF document, max 5MB).
- **Expect:** `201 Created` — File uploaded to Cloudinary, returning secure URL.

---

## 💳 STEP 8: Real bKash Tokenized Payment Integration

Test real bKash Sandbox payment initiation, execution, and automatic subscription upgrade.

### 8.1 Initiate Payment Session
- **Endpoint:** `POST /api/v1/payments/initiate`
- **Headers:** `Authorization: Bearer <OrgOwnerToken>` (`amran.xgroup@gmail.com`)
- **Request Body:** `{ "organizationId": "<org_id>", "plan": "PRO" }`
- **Expect:** `200 OK` — Returns `bkashURL` and `paymentID`.

### 8.2 Perform bKash Sandbox Payment
1. Open the returned `bkashURL` in your browser.
2. Enter bKash Wallet Number: `01770778014`
3. Enter OTP: `123456`
4. Enter PIN: `12121`
5. Upon completion, bKash redirects to your callback URL.

### 8.3 Execute & Verify Payment
- **Endpoint:** `POST /api/v1/payments/execute`
- **Request Body:** `{ "paymentID": "<bkash_payment_id>" }`
- **Expect:** `200 OK` — Verifies transaction, updates payment status to `SUCCESS`, and upgrades organization subscription from `FREE` → `PRO`.

---

## 📊 STEP 9: Organization Dashboard & Caching

### 9.1 Fetch Dashboard Analytics
- **Endpoint:** `GET /api/v1/organizations/:organizationId/dashboard`
- **Expect:** `200 OK` — Returns task counts, project progress, and sprint metrics.
- **Cache Check:** First request returns header `X-Cache: MISS`. Subsequent requests return `X-Cache: HIT` (cached via Redis for 60s).

---

## 🛡️ STEP 10: Server-Side Validation & Structured Errors

### 10.1 Trigger Zod Input Validation Error
- **Endpoint:** `POST /api/v1/auth/register`
- **Invalid Body:** `{ "email": "bad-email", "password": "123" }`
- **Expect:** `400 Bad Request` with structured error payload:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "message": "Validation Error",
    "errors": [
      { "path": "email", "message": "Invalid email format" },
      { "path": "password", "message": "Password must be at least 6 characters" }
    ]
  }
  ```

### 10.2 Trigger 404 Route Not Found
- **Endpoint:** `GET /api/v1/invalid-route`
- **Expect:** `404 Not Found` (`"API Route Not Found"`).

---

## 🏁 Summary Checklist for Submission

- [x] **20+ Endpoints Verified**
- [x] **Real Email OTP & Reset Delivered to Inbox**
- [x] **3-Role Authorization Enforced**
- [x] **bKash Sandbox Payment Completed**
- [x] **Structured Success/Error Standard Preserved**
