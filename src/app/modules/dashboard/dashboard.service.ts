import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
  DASHBOARD_TTL_SECONDS,
  dashboardKey,
  getCachedJSON,
  setCachedJSON,
} from "../../lib/cache";

type StatusCount = { status: string; count: number };

type DashboardStats = {
  organization: { id: string; name: string; slug: string; status: string };
  counts: { projects: number; members: number; teams: number; sprints: number; tasks: number };
  projectsByStatus: StatusCount[];
  sprintsByStatus: StatusCount[];
  tasksByStatus: StatusCount[];
  overdueTasks: number;
  recentProjects: Array<{ id: string; name: string; status: string; taskCount: number; updatedAt: Date }>;
};

const getOrgDashboard = async (userId: string, organizationId: string) => {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership || membership.deletedAt) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
  }

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!organization) throw new AppError(httpStatus.NOT_FOUND, "Organization not found");

  const key = dashboardKey(organizationId);
  const cached = await getCachedJSON<Omit<DashboardStats, "organization">>(key);
  if (cached) {
    return { organization, ...cached, cached: true as const };
  }

  const activeProjects = { organizationId, deletedAt: null } as const;
  const activeSprints = { project: { organizationId, deletedAt: null }, deletedAt: null } as const;
  const activeTasks = { project: { organizationId, deletedAt: null }, deletedAt: null } as const;

  const [
    projectCount,
    projectsByStatus,
    memberCount,
    teamCount,
    sprintCount,
    sprintsByStatus,
    taskCount,
    tasksByStatus,
    overdueTasks,
    recentProjects,
  ] = await Promise.all([
    prisma.project.count({ where: activeProjects }),
    prisma.project.groupBy({ by: ["status"], where: activeProjects, _count: { _all: true } }),
    prisma.organizationMember.count({ where: { organizationId, deletedAt: null } }),
    prisma.team.count({ where: { organizationId, deletedAt: null } }),
    prisma.sprint.count({ where: activeSprints }),
    prisma.sprint.groupBy({ by: ["status"], where: activeSprints, _count: { _all: true } }),
    prisma.task.count({ where: activeTasks }),
    prisma.task.groupBy({ by: ["status"], where: activeTasks, _count: { _all: true } }),
    prisma.task.count({
      where: { ...activeTasks, dueDate: { lt: new Date() }, NOT: { status: "DONE" } },
    }),
    prisma.project.findMany({
      where: activeProjects,
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const stats = {
    counts: { projects: projectCount, members: memberCount, teams: teamCount, sprints: sprintCount, tasks: taskCount },
    projectsByStatus: projectsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    sprintsByStatus: sprintsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    tasksByStatus: tasksByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    overdueTasks,
    recentProjects: recentProjects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      taskCount: p._count.tasks,
      updatedAt: p.updatedAt,
    })),
  };

  await setCachedJSON(key, stats, DASHBOARD_TTL_SECONDS);

  return { organization, ...stats, cached: false as const };
};

export const DashboardService = {
  getOrgDashboard,
};
