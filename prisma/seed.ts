/**
 * Prisma Seed — TaskFlow
 * Creates: 1 super admin, 1 demo org (Pro), 3 users, 1 project with tasks
 *
 * Run: npx prisma db seed   (or: npx tsx prisma/seed.ts)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  OrgRole,
  PlatformRole,
  SprintStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  TaskPriority,
  TaskStatus,
} from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱  Seeding TaskFlow database...");

  const SALT = 12;

  // ── 1. Super Admin ─────────────────────────────────────────
  const superAdminPassword = await bcrypt.hash(
    process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123",
    SALT,
  );

  const superAdmin = await prisma.user.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL ?? "admin@taskflow.dev" },
    update: { isEmailVerified: true, emailVerifiedAt: new Date() },
    create: {
      name: process.env.SUPER_ADMIN_NAME ?? "Super Admin",
      email: process.env.SUPER_ADMIN_EMAIL ?? "admin@taskflow.dev",
      password: superAdminPassword,
      platformRole: PlatformRole.SUPER_ADMIN,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✅  Super Admin: ${superAdmin.email}`);

  // ── 2. Demo users ──────────────────────────────────────────
  const ownerPassword = await bcrypt.hash("Owner@123", SALT);
  const memberPassword = await bcrypt.hash("Member@123", SALT);

  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.com" },
    update: { isEmailVerified: true },
    create: {
      name: "Demo Owner",
      email: "owner@demo.com",
      password: ownerPassword,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const member1 = await prisma.user.upsert({
    where: { email: "alice@demo.com" },
    update: { isEmailVerified: true },
    create: {
      name: "Alice Demo",
      email: "alice@demo.com",
      password: memberPassword,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const member2 = await prisma.user.upsert({
    where: { email: "bob@demo.com" },
    update: { isEmailVerified: true },
    create: {
      name: "Bob Demo",
      email: "bob@demo.com",
      password: memberPassword,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log("✅  Demo users: owner, alice, bob");

  // ── 3. Organization + Subscription (Pro) ──────────────────
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: "demo-org" },
  });

  const org = existingOrg
    ? existingOrg
    : await prisma.organization.create({
        data: {
          name: "Demo Organization",
          slug: "demo-org",
          ownerUserId: owner.id,
          subscription: {
            create: {
              plan: SubscriptionPlan.PRO,
              status: SubscriptionStatus.ACTIVE,
              maxProjects: 20,
              maxMembers: 50,
              currentPeriodEnd: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000,
              ),
            },
          },
        },
      });

  console.log(`✅  Organization: ${org.name}`);

  // ── 4. Org Memberships ─────────────────────────────────────
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: owner.id } },
    update: {},
    create: { organizationId: org.id, userId: owner.id, role: OrgRole.ORG_OWNER, joinedAt: new Date() },
  });

  for (const member of [member1, member2]) {
    await prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: member.id } },
      update: {},
      create: { organizationId: org.id, userId: member.id, role: OrgRole.MEMBER, joinedAt: new Date() },
    });
  }

  console.log("✅  Org memberships created");

  // ── 5. Project + Members ───────────────────────────────────
  const existingProject = await prisma.project.findFirst({
    where: { organizationId: org.id, name: "Demo Project" },
  });

  const project = existingProject
    ? existingProject
    : await prisma.project.create({
        data: {
          organizationId: org.id,
          name: "Demo Project",
          description: "A seeded demo project for TaskFlow",
        },
      });

  for (const user of [owner, member1, member2]) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
      update: {},
      create: {
        projectId: project.id,
        userId: user.id,
        role: user.id === owner.id ? OrgRole.ORG_OWNER : OrgRole.MEMBER,
      },
    });
  }

  console.log(`✅  Project: ${project.name}`);

  // ── 6. Sprint ──────────────────────────────────────────────
  const existingSprint = await prisma.sprint.findFirst({
    where: { projectId: project.id },
  });

  const sprint = existingSprint
    ? existingSprint
    : await prisma.sprint.create({
        data: {
          projectId: project.id,
          name: "Sprint 1",
          status: SprintStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

  // ── 7. Tasks ───────────────────────────────────────────────
  const tasks = [
    { title: "Set up project repository", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assigneeId: owner.id },
    { title: "Design database schema", status: TaskStatus.DONE, priority: TaskPriority.HIGH, assigneeId: member1.id },
    { title: "Implement auth module", status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, assigneeId: member1.id },
    { title: "Build task CRUD endpoints", status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, assigneeId: member2.id },
    { title: "Write API documentation", status: TaskStatus.TODO, priority: TaskPriority.LOW, assigneeId: member2.id },
  ];

  for (const taskData of tasks) {
    const existing = await prisma.task.findFirst({
      where: { projectId: project.id, title: taskData.title },
    });
    if (!existing) {
      await prisma.task.create({
        data: { ...taskData, projectId: project.id, sprintId: sprint.id },
      });
    }
  }

  console.log("✅  5 demo tasks created");
  console.log("\n🎉  Seed complete!\n");
  console.log("  Super Admin → admin@taskflow.dev / SuperAdmin@123");
  console.log("  Org Owner   → owner@demo.com     / Owner@123");
  console.log("  Members     → alice@demo.com, bob@demo.com / Member@123");
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
