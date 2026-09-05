import httpStatus from "http-status";
import type { OrganizationStatus, PlatformRole } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta, calculatePagination } from "../../utils/pagination";

const listOrganizations = async (query: { page?: number; limit?: number; status?: OrganizationStatus }) => {
  const { page, limit, skip } = calculatePagination(query);
  const where = {
    deletedAt: null,
    ...(query.status && { status: query.status }),
  };

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        subscription: true,
        _count: {
          select: {
            members: { where: { deletedAt: null } },
            projects: { where: { deletedAt: null } },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.organization.count({ where }),
  ]);

  return { data: organizations, meta: buildPaginationMeta(total, page, limit) };
};

const updateOrganizationStatus = async (
  adminId: string,
  organizationId: string,
  status: OrganizationStatus,
) => {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
  });
  if (!organization) throw new AppError(httpStatus.NOT_FOUND, "Organization not found");

  if (organization.status === status) return organization;

  const updated = await prisma.organization.update({
    where: { id: organizationId },
    data: { status },
  });

  await prisma.activityLog.create({
    data: {
      userId: adminId,
      action: status === "SUSPENDED" ? "ORGANIZATION_SUSPENDED" : "ORGANIZATION_UNSUSPENDED",
      meta: { organizationId, oldStatus: organization.status, newStatus: status },
    },
  });

  return updated;
};

const listUsers = async (query: {
  page?: number;
  limit?: number;
  search?: string;
  platformRole?: PlatformRole;
  isActive?: boolean;
}) => {
  const { page, limit, skip } = calculatePagination(query);
  const where = {
    deletedAt: null,
    ...(query.platformRole && { platformRole: query.platformRole }),
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: "insensitive" as const } },
        { email: { contains: query.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        provider: true,
        profileImage: true,
        platformRole: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        _count: { select: { memberships: { where: { deletedAt: null } } } },
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  return { data: users, meta: buildPaginationMeta(total, page, limit) };
};

const updateUserStatus = async (adminId: string, targetUserId: string, isActive: boolean) => {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.deletedAt) throw new AppError(httpStatus.NOT_FOUND, "User not found");
  if (target.platformRole === "SUPER_ADMIN") {
    throw new AppError(httpStatus.FORBIDDEN, "Super admin accounts cannot be blocked");
  }
  if (target.isActive === isActive) return target;

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive },
    omit: { password: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: adminId,
      action: isActive ? "USER_UNBLOCKED" : "USER_BLOCKED",
      meta: { targetUserId },
    },
  });

  return updated;
};

const dashboardStats = async () => {
  const [
    totalOrganizations,
    organizationsByStatus,
    totalUsers,
    usersByRole,
    activeSubscriptions,
    subscriptionsByPlan,
    revenue,
    paymentsByStatus,
  ] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.organization.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.groupBy({ by: ["platformRole"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return {
    totals: {
      organizations: totalOrganizations,
      users: totalUsers,
      activeSubscriptions,
      revenueBDT: Number(revenue._sum.amount ?? 0),
    },
    organizationsByStatus: organizationsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    usersByRole: usersByRole.map((r) => ({ role: r.platformRole, count: r._count._all })),
    subscriptionsByPlan: subscriptionsByPlan.map((r) => ({ plan: r.plan, count: r._count._all })),
    paymentsByStatus: paymentsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
  };
};

const auditLogs = async (query: {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
}) => {
  const { page, limit, skip } = calculatePagination(query);
  const where = {
    ...(query.action && { action: query.action }),
    ...(query.userId && { userId: query.userId }),
    ...((query.from || query.to) && {
      createdAt: {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      },
    }),
  };

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, title: true } },
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { data: logs, meta: buildPaginationMeta(total, page, limit) };
};

export const AdminService = {
  listOrganizations,
  updateOrganizationStatus,
  listUsers,
  updateUserStatus,
  dashboardStats,
  auditLogs,
};
