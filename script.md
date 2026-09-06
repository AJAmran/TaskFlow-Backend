# 🎥 TaskFlow API Walkthrough Video Script (5–10 Minutes)

> 💡 **নোট:** এই স্ক্রিপ্টটি আপনার ভিডিও রেকর্ডিংয়ের (Loom বা OBS) জন্য তৈরি করা হয়েছে। স্ক্রিনে Postman/Thunder Client খোলা রেখে ধাপগুলো অনুসরণ করুন এবং মুখে বাংলায় কথা বলুন।

---

## ⏱️ ভিডিও টাইমলাইন ওভারভিউ

| সময় | সেকশন / বিষয়বস্তু | Postman/Screen Action |
|:---:|:---|:---|
| **0:00 - 1:00** | **১. পরিচিতি ও আর্কিটেকচার** | VS Code / Postman Title view |
| **1:00 - 3:00** | **২. ৩টি রোল ডেমো (RBAC & 403 Test)** | Auth Tokens (`SUPER_ADMIN`, `ORG_OWNER`, `MEMBER`) |
| **3:00 - 5:00** | **৩. CRUD অপারেশনস** | Organizations, Projects, Tasks Endpoints |
| **5:00 - 6:30** | **৪. ইনপুট ভ্যালিডেশন ও এরর হ্যান্ডলিং** | Zod validation error, 401 & 404 test |
| **6:30 - 8:30** | **৫. bKash পেমেন্ট ফ্লো ডেমো** | `/initiate`, `/callback`, `/execute` |
| **8:30 - 10:00**| **৬. টেকনিক্যাল চ্যালেঞ্জ ও সমাপনী** | Prisma Transactions / Redis caching code explanation |

---

## 🎙️ বিস্তারিত বাংলা ডায়ালগ ও অ্যাকশন নির্দেশিকা

---

### 📍 ১. পরিচিতি ও আর্কিটেকচার (0:00 - 1:00)

**[কথা বলুন]:**
> "আসসালামু আলাইকুম। আমি ইমরান হোসেন। আজ আমি উপস্থাপন করছি আমার B7A6 ব্যাকএন্ড প্রজেক্ট — **TaskFlow (Multi-tenant Project Management SaaS)**।
> 
> এটি একটি প্রডাকশন-রেডি RESTful API যা বিভিন্ন অর্গানাইজেশনকে তাদের টিম, প্রজেক্ট, স্প্রিন্ট, টাস্ক এবং মেম্বারশিপ সহজে ম্যানেজ করতে সাহায্য করে।
> 
> ব্যাকএন্ড টেক স্ট্যাক হিসেবে ব্যবহার করা হয়েছে **Node.js, Express.js, TypeScript, PostgreSQL** এবং **Prisma 7 ORM**। এছাড়া নিরাপত্তা ও পারফরম্যান্সের জন্য ব্যবহার করা হয়েছে **Zod Validation, JWT Auth, Google Social Login, Redis Caching + Rate Limiting** এবং **bKash Payment Gateway**।
> 
> আমাদের আর্কিটেকচার অত্যন্ত মডিউলার এবং ক্লিন: **Routes → Middleware → Controllers → Services → Prisma Models** প্যাটার্ন অনুসরণ করা হয়েছে।"

---

### 📍 ২. ৩টি রোল ডেমোস্ট্রেশন (RBAC & 403 Test) (1:00 - 3:00)

**[কথা বলুন]:**
> "আমাদের সিস্টেমে ৩টি সুনির্দিষ্ট রোল রয়েছে:
> ১. `SUPER_ADMIN` — প্ল্যাটফর্ম অ্যাডমিন
> ২. `ORG_OWNER` — অর্গানাইজেশনের ওনার/ম্যানেজার
> ৩. `MEMBER` — টিম মেম্বার
> 
> এখন আমি Postman-এ ৩টি রোলের এক্সেস কন্ট্রোল টেস্ট করে দেখাচ্ছি।"

**[Postman Action 1 — Member Login]:**
- `POST /api/v1/auth/login` দিয়ে `alice@demo.com` (Member) হিসেবে লগইন করুন এবং Token টি `Bearer Token` হিসেবে সেভ করুন।
**[কথা বলুন]:**
> "প্রথমে আমি একজন সাধারণ Member (`alice@demo.com`) দিয়ে লগইন করে টোকেন পেলাম।"

**[Postman Action 2 — Role Restriction 403 Forbidden Test]:**
- মেম্বারের টোকেন দিয়ে `GET /api/v1/admin/organizations` এ হিট করুন।
- Response দেখাবে: `403 Forbidden` (`"message": "Super Admin access required"`).
**[কথা বলুন]:**
> "দেখুন, মেম্বার টোকেন দিয়ে অ্যাডমিন রুট `/api/v1/admin/organizations` এ কল করায় আমাদের ব্যাকএন্ড থেকে `403 Forbidden` রেসপন্স এসেছে। অর্থাৎ রোল এক্সেস সম্পূর্ণ সিকিউর।"

**[Postman Action 3 — Super Admin Access]:**
- `superadmin@gmail.com` দিয়ে লগইন করুন এবং টোকেন নিয়ে `GET /api/v1/admin/dashboard-stats` এবং `GET /api/v1/admin/users` এ হিট করুন।
- Response: `200 OK` (সফল রেসপন্স)।
**[কথা বলুন]:**
> "এখন Super Admin দিয়ে কল করতেই আমরা সফলভাবে সিস্টেম ওয়াইড ড্যাশবোর্ড স্ট্যাটস এবং ইউজার লিস্ট পেলাম।"

---

### 📍 ৩. CRUD অপারেশনস ডেমো (3:00 - 5:00)

**[কথা বলুন]:**
> "এখন আমি অর্গানাইজেশন ও টাস্কের CRUD অপারেশনগুলো দেখাচ্ছি।"

**[Postman Action 1 — Create Project (POST)]:**
- `POST /api/v1/organizations/:orgId/projects`
- Body: `{ "name": "Mobile App Dev", "description": "Flutter app" }`
- Response: `201 Created`
**[কথা বলুন]:**
> "প্রথমে একটি প্রজেক্ট তৈরি করলাম। এটি ডেটাবেজে সেভ হয়ে প্রজেক্ট অবজেক্ট রিটার্ন করেছে।"

**[Postman Action 2 — Create Task & List with Pagination/Filter (GET)]:**
- `POST /api/v1/organizations/:orgId/projects/:projId/tasks`
- `GET /api/v1/organizations/:orgId/projects/:projId/tasks?page=1&limit=10&status=TODO&sortBy=createdAt`
- Response: Structured JSON response with `meta` (page, limit, total).
**[কথা বলুন]:**
> "আমরা টাস্ক ফিল্টারিং, পেজিনেশন এবং সর্টিং সাপোর্ট সহ টাস্ক লিস্ট পেলাম।"

**[Postman Action 3 — Update Task Status (PATCH)]:**
- `PATCH /api/v1/organizations/:orgId/projects/:projId/tasks/:taskId/status`
- Body: `{ "status": "IN_PROGRESS" }`
- Response: `200 OK`

**[Postman Action 4 — Soft Delete Project (DELETE)]:**
- `DELETE /api/v1/organizations/:orgId/projects/:projId`
- Response: `200 OK`
**[কথা বলুন]:**
> "ডিলেট করার সাথে সাথে আমাদের ব্যাকএন্ড সরাসরি হার্ড ডিলেট না করে `deletedAt` টাইমস্ট্যাম্প সেট করে সফট ডিলেট সম্পাদন করে।"

---

### 📍 ৪. ইনপুট ভ্যালিডেশন ও এরর হ্যান্ডলিং (5:00 - 6:30)

**[কথা বলুন]:**
> "আমাদের ব্যাকএন্ডে Zod ব্যবহার করে সার্ভার-সাইড ইনপুট ভ্যালিডেশন করা হয়েছে। এবং সব এরর রেসপন্স একটি স্ট্যান্ডার্ড ফরম্যাট মেনে চলে:
> `{ "success": false, "message": "...", "errors": [...] }`"

**[Postman Action 1 — Validation Error]:**
- `POST /api/v1/auth/register` এ ভুল ইমেইল বা ছোট পাসওয়ার্ড পাঠান (যেমন `"email": "invalid-email"`, `"password": "123"`).
- Response: `400 Bad Request` সহ স্পষ্ট Zod error array।
**[কথা বলুন]:**
> "দেখুন, ইনভ্যালিড ইমেইল দিতেই জড ভ্যালিডেশন ধরে ফেলেছে এবং `errors` এরেতে কোন ফিল্ডে কী সমস্যা তা পরিষ্কারভাবে দেখাচ্ছে।"

**[Postman Action 2 — 404 Not Found & 401 Unauthorized]:**
- ভুল রুটে হিট করুন (`GET /api/v1/unknown-route`).
- Response: `404 Not Found` (`"API Route Not Found"`).
- বিনা টোকেনে প্রটেক্টেড রুটে হিট করুন.
- Response: `401 Unauthorized` (`"You are not authorized"`).

---

### 📍 ৫. bKash পেমেন্ট ফ্লো ডেমো (6:30 - 8:30)

**[কথা বলুন]:**
> "আমাদের প্রজেক্টে রিয়েল পেমেন্ট প্রসেসিংয়ের জন্য **bKash Tokenized Checkout Sandbox** ইন্টিগ্রেট করা হয়েছে।"

**[Postman Action 1 — Initiate Payment]:**
- `POST /api/v1/payments/initiate`
- Body: `{ "organizationId": "<org_id>", "plan": "PRO" }`
- Response: `200 OK` সহ `payment` রেকর্ড এবং `bkashURL` লিঙ্ক।
**[কথা বলুন]:**
> "পেমেন্ট ইনিশিয়েট করার পর bKash আমাদের একটি সিকিউর `bkashURL` দিয়েছে। অর্গানাইজেশন ওনার পেমেন্ট সম্পন্ন করতে এই ইউআরএলে রিডাইরেক্ট হবে।"

**[Postman Action 2 — Execute Payment]:**
- `POST /api/v1/payments/execute`
- Body: `{ "paymentID": "<bkash_payment_id>" }`
- Response: `200 OK` (`"Payment verified and subscription upgraded"`).
**[কথা বলুন]:**
> "পেমেন্ট সম্পন্ন হওয়ার পর আমাদের ব্যাকএন্ড গেটওয়েতে ভেরিফাই করে এবং প্রিজমা ট্রানজেকশনের মাধ্যমে অর্গানাইজেশনের সাবস্ক্রিপশন প্ল্যান `FREE` থেকে `PRO`-তে আপডেট করে দেয়।"

---

### 📍 ৬. টেকনিক্যাল চ্যালেঞ্জ ও সমাপনী (8:30 - 10:00)

**[কথা বলুন]:**
> "এই প্রজেক্টটি করার সময় একটি অন্যতম টেকনিক্যাল চ্যালেঞ্জ ছিল **Prisma Transactions এবং Multi-tenant Dynamic Limits** নিশ্চিত করা।
> 
> উদাহরণস্বরূপ, যখন কোনো অর্গানাইজেশন প্রজেক্ট তৈরি করে বা পেমেন্ট করে সাবস্ক্রিপশন আপডেট করে, তখন একই ট্রানজেকশনে প্ল্যান লিমিট চেক করা এবং স্টেট আপডেট নিশ্চিত করতে হয়েছে যাতে কোনো রেস কন্ডিশন না ঘটে।
> 
> এছাড়া **Redis Caching** ব্যবহার করে ড্যাশবোর্ড ডেটার রেসপন্স টাইম কমানো হয়েছে এবং API abuse রোধে **Redis Rate Limiter** যুক্ত করা হয়েছে।
> 
> আশা করি প্রজেক্টটি সকল রিকোয়ারমেন্টস পূর্ণ করেছে। ধন্যবাদ!"

---

## 🎯 টিপস রেকর্ডিংয়ের সময়:
1. স্ক্রিন পরিষ্কার রাখুন এবং Postman Collections সুন্দরভাবে সাজিয়ে রাখুন।
2. কথা বলার গতি স্বাভাবিক ও স্পষ্ট রাখুন।
3. রেকর্ডিং শেষে Loom / Google Drive লিঙ্ক বানিয়ে সাবমিট করুন (Google Drive লিঙ্ক হলে "Anyone with the link can view" নিশ্চিত করুন)।
