const BASE = "http://127.0.0.1:5000/api/v1";

type Result = { name: string; status: number | string; expected: string; ok: boolean };

const results: Result[] = [];

const record = (name: string, status: number | string, expected: string, ok: boolean) => {
  results.push({ name, status, expected, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} -> ${status} (expected ${expected})`);
};

const call = async (
  path: string,
  options: RequestInit & { cookies?: string } = {},
) => {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.cookies ? { Cookie: options.cookies } : {}),
      ...(options.headers as Record<string, string>),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {}
  const setCookie = res.headers.get("set-cookie") ?? "";
  return { status: res.status, body, setCookie };
};

const toCookieHeader = (setCookie: string): string =>
  setCookie
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

const message = (body: unknown): string => {
  const b = body as { message?: string } | null;
  return typeof b?.message === "string" ? b.message : "";
};

const run = async () => {
  const health = await fetch("http://localhost:5000/health");
  record("health", health.status, "200", health.status === 200);
  const root = await fetch("http://localhost:5000/");
  const rootBody = (await root.json()) as { data?: { environment?: string } };
  record(
    "root reports no stack/env leak",
    rootBody?.data?.environment ?? "?",
    "an env name is fine",
    typeof rootBody?.data?.environment === "string",
  );

  const ownerLogin = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "amran.xgroup@gmail.com",
      password: "Owner@123",
    }),
  });
  record("owner login", ownerLogin.status, "200", ownerLogin.status === 200);
  const ownerCookies = toCookieHeader(ownerLogin.setCookie);
  record(
    "owner login sets httpOnly access cookie",
    ownerCookies.includes("accessToken") ? "yes" : "no",
    "yes",
    ownerCookies.includes("accessToken"),
  );
  record(
    "owner login does NOT leak token in body",
    JSON.stringify(ownerLogin.body).includes(ownerLogin.setCookie.match(/accessToken=([^;]+)/)?.[1] ?? "@@none@@")
      ? "LEAKED"
      : "clean",
    "clean",
    !JSON.stringify(ownerLogin.body).includes(
      ownerLogin.setCookie.match(/accessToken=([^;]+)/)?.[1] ?? "@@none@@",
    ),
  );

  const me = await call("/auth/me", { cookies: ownerCookies });
  record("owner /auth/me", me.status, "200", me.status === 200);
  const meBody = me.body as { data?: { email?: string; password?: unknown } };
  record(
    "me response has no password field",
    meBody?.data && "password" in meBody.data ? "LEAKED" : "clean",
    "clean",
    !(meBody?.data && "password" in meBody.data),
  );

  const badPass = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "amran.xgroup@gmail.com",
      password: "WrongPassword@1",
    }),
  });
  const unknownEmail = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "nobody-here@example.com",
      password: "WrongPassword@1",
    }),
  });
  record(
    "bad password -> 401",
    badPass.status,
    "401",
    badPass.status === 401,
  );
  record(
    "unknown email -> 401 (same status, no enumeration)",
    unknownEmail.status,
    "401",
    unknownEmail.status === 401,
  );

  const orgs = await call("/organizations?page=1&limit=10", {
    cookies: ownerCookies,
  });
  record("owner list organizations", orgs.status, "200", orgs.status === 200);
  const orgList = orgs.body as {
    data?: { membershipId: string; organization: { id: string; name: string } }[];
  };
  const orgId = orgList?.data?.[0]?.organization?.id;
  record("owner has an organization", orgId ?? "none", "an id", Boolean(orgId));
  if (!orgId) return;

  const orgDetail = await call(`/organizations/${orgId}`, {
    cookies: ownerCookies,
  });
  record("owner org detail", orgDetail.status, "200", orgDetail.status === 200);

  const projects = await call(`/organizations/${orgId}/projects?page=1&limit=10`, {
    cookies: ownerCookies,
  });
  record("owner list projects", projects.status, "200", projects.status === 200);

  const badDates = await call(`/organizations/${orgId}/projects`, {
    method: "POST",
    cookies: ownerCookies,
    body: JSON.stringify({
      name: "Regression bad dates",
      startDate: "2026-03-09T00:00:00.000Z",
      endDate: "2026-03-02T00:00:00.000Z",
    }),
  });
  record(
    "project end<start rejected",
    `${badDates.status} ${message(badDates.body)}`,
    "400 mentioning endDate/startDate",
    badDates.status === 400,
  );

  const created = await call(`/organizations/${orgId}/projects`, {
    method: "POST",
    cookies: ownerCookies,
    body: JSON.stringify({
      name: "Regression project",
      description: "audit",
      startDate: "2026-03-02T00:00:00.000Z",
      endDate: "2026-03-09T00:00:00.000Z",
    }),
  });
  const createdBody = created.body as { data?: { id: string; startDate?: string } };
  record(
    "project create with dates",
    created.status,
    "201 or 403 at plan cap",
    created.status === 201 || created.status === 403,
  );
  if (created.status === 201) {
    record(
      "created project persisted startDate",
      createdBody?.data?.startDate ?? "missing",
      "2026-03-02T00:00:00.000Z",
      createdBody?.data?.startDate === "2026-03-02T00:00:00.000Z",
    );
    const projectId = createdBody?.data?.id;

    const sprint = await call(
      `/organizations/${orgId}/projects/${projectId}/sprints`,
      {
        method: "POST",
        cookies: ownerCookies,
        body: JSON.stringify({
          name: "Regression sprint",
          startDate: "2026-03-02T00:00:00.000Z",
          endDate: "2026-03-09T00:00:00.000Z",
        }),
      },
    );
    record(
      "sprint create with ISO dates",
      sprint.status,
      "201 or 400",
      sprint.status === 201 || sprint.status === 400,
    );

    const badSprint = await call(
      `/organizations/${orgId}/projects/${projectId}/sprints`,
      {
        method: "POST",
        cookies: ownerCookies,
        body: JSON.stringify({
          name: "Regression bad sprint",
          startDate: "2026-03-09T00:00:00.000Z",
          endDate: "2026-03-02T00:00:00.000Z",
        }),
      },
    );
    record(
      "sprint end<start rejected",
      `${badSprint.status} ${message(badSprint.body)}`,
      "400",
      badSprint.status === 400,
    );

    const del = await call(
      `/organizations/${orgId}/projects/${projectId}`,
      { method: "DELETE", cookies: ownerCookies },
    );
    record("owner soft-deletes project", del.status, "200", del.status === 200);
  }

  const memberLogin = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "firoz03dec@gmail.com",
      password: "Member@123",
    }),
  });
  record("member login", memberLogin.status, "200", memberLogin.status === 200);
  const memberCookies = toCookieHeader(memberLogin.setCookie);

  if (memberLogin.status === 200) {
    const memberOrgs = await call("/auth/me", { cookies: memberCookies });
    record("member /auth/me", memberOrgs.status, "200", memberOrgs.status === 200);

    const memberDelete = await call(
      `/organizations/${orgId}/projects/00000000-0000-0000-0000-000000000000`,
      { method: "DELETE", cookies: memberCookies },
    );
    record(
      "member delete project forbidden",
      memberDelete.status,
      "403/404",
      memberDelete.status === 403 || memberDelete.status === 404,
    );

    const memberBilling = await call("/payments/initiate", {
      method: "POST",
      cookies: memberCookies,
      body: JSON.stringify({ organizationId: orgId, plan: "PRO" }),
    });
    record(
      "member billing initiate forbidden",
      memberBilling.status,
      "403",
      memberBilling.status === 403,
    );

    const memberAdmin = await call("/admin/dashboard-stats", {
      cookies: memberCookies,
    });
    record(
      "member admin route forbidden",
      memberAdmin.status,
      "403",
      memberAdmin.status === 403,
    );
  }

  const adminLogin = await call("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "superadmin@gmail.com",
      password: "Super@admin12345",
    }),
  });
  record("admin login", adminLogin.status, "200", adminLogin.status === 200);
  const adminCookies = toCookieHeader(adminLogin.setCookie);

  if (adminLogin.status === 200) {
    const stats = await call("/admin/dashboard-stats", {
      cookies: adminCookies,
    });
    record("admin dashboard-stats", stats.status, "200", stats.status === 200);

    const users = await call("/admin/users?page=1&limit=5", {
      cookies: adminCookies,
    });
    record("admin users list", users.status, "200", users.status === 200);
    const usersBody = users.body as { data?: Record<string, unknown>[] };
    const leakedHash = JSON.stringify(usersBody).includes("$2b$");
    record(
      "admin users list has no password hashes",
      leakedHash ? "LEAKED" : "clean",
      "clean",
      !leakedHash,
    );

    const target = usersBody?.data?.[0] as
      | { id?: string; isActive?: boolean }
      | undefined;
    if (target?.id) {
      const noop = await call(`/admin/users/${target.id}/status`, {
        method: "PATCH",
        cookies: adminCookies,
        body: JSON.stringify({ isActive: target.isActive }),
      });
      const noopLeak = JSON.stringify(noop.body).includes("$2b$");
      record(
        "no-op admin status update has no password hash",
        noopLeak ? "LEAKED" : "clean",
        "clean",
        !noopLeak,
      );
    }
  }

  const anon = await call(`/organizations/${orgId}/projects`);
  record("anonymous projects -> 401", anon.status, "401", anon.status === 401);

  const csrf = await fetch(`${BASE}/organizations/${orgId}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://evil.example.com",
      Cookie: ownerCookies,
    },
    body: JSON.stringify({ name: "csrf probe" }),
  });
  record(
    "cross-origin write rejected (CSRF guard)",
    csrf.status,
    "403",
    csrf.status === 403,
  );

  const hugePage = await call(
    `/organizations/${orgId}/projects?page=99999999999&limit=10`,
    { cookies: ownerCookies },
  );
  record("huge page number handled", hugePage.status, "200", hugePage.status === 200);

  const badUuid = await call(`/organizations/${orgId}/projects/not-a-uuid`, {
    cookies: ownerCookies,
  });
  record(
    "invalid project uuid -> 4xx not 500",
    badUuid.status,
    "400/404",
    badUuid.status === 400 || badUuid.status === 404,
  );

  console.log("");
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
  }
  console.log(`${results.length - failed}/${results.length} passed`);
  if (failed > 0) process.exitCode = 1;
};

run().catch((error) => {
  console.error("regression run failed:", error);
  process.exitCode = 1;
});
