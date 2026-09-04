import httpStatus from "http-status";
import { OrgRole, SprintStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { calculatePagination } from "../../utils/pagination";

const ensureOrgMembership = async (userId: string, organizationId: string, requireOwner = false) => {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership || membership.deletedAt) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
  }
  if (requireOwner && membership.role !== OrgRole.ORG_OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, "Only ORG_OWNER can perform this action");
  }
  const org = await prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
  if (!org) throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
  return membership;
};

const ensureProject = async (organizationId: string, projectId: string) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
  });
  if (!project) throw new AppError(httpStatus.NOT_FOUND, "Project not found");
  return project;
};

const ensureSprint = async (projectId: string, sprintId: string) => {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId, deletedAt: null },
  });
  if (!sprint) throw new AppError(httpStatus.NOT_FOUND, "Sprint not found");
  return sprint;
};

const createSprint = async (
  userId: string,
  organizationId: string,
  projectId: string,
  payload: { name: string; startDate: string; endDate: string },
) => {
  await ensureOrgMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);

  const startDate = new Date(payload.startDate);
  const endDate = new Date(payload.endDate);
  if (startDate >= endDate) {
    throw new AppError(httpStatus.BAD_REQUEST, "startDate must be before endDate");
  }

  const sprint = await prisma.sprint.create({
    data: {
      projectId,
      name: payload.name.trim(),
      startDate,
      endDate,
      status: SprintStatus.PLANNED,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "SPRINT_CREATED",
      meta: { organizationId, projectId, sprintId: sprint.id, name: sprint.name },
    },
  });

  return sprint;
};

const listSprints = async (
  userId: string,
  organizationId: string,
  projectId: string,
  query: { page?: number; limit?: number; status?: SprintStatus },
) => {
  await ensureOrgMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);

  const { page, limit, skip } = calculatePagination(query);
  const where = {
    projectId,
    deletedAt: null,
    ...(query.status && { status: query.status }),
  };

  const [sprints, total] = await Promise.all([
    prisma.sprint.findMany({
      where,
      include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
      skip,
      take: limit,
      orderBy: { startDate: "asc" },
    }),
    prisma.sprint.count({ where }),
  ]);

  return { data: sprints, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getSprintById = async (userId: string, organizationId: string, projectId: string, sprintId: string) => {
  await ensureOrgMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId, deletedAt: null },
    include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
  });
  if (!sprint) throw new AppError(httpStatus.NOT_FOUND, "Sprint not found");
  return sprint;
};

const updateSprint = async (
  userId: string,
  organizationId: string,
  projectId: string,
  sprintId: string,
  payload: { name?: string; startDate?: string; endDate?: string },
) => {
  await ensureOrgMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);
  const sprint = await ensureSprint(projectId, sprintId);

  if (sprint.status !== SprintStatus.PLANNED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Only PLANNED sprints can be updated. Current status: ${sprint.status}`,
    );
  }

  const startDate = payload.startDate !== undefined ? new Date(payload.startDate) : sprint.startDate;
  const endDate = payload.endDate !== undefined ? new Date(payload.endDate) : sprint.endDate;
  if (startDate >= endDate) {
    throw new AppError(httpStatus.BAD_REQUEST, "startDate must be before endDate");
  }

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
      ...(payload.startDate !== undefined && { startDate }),
      ...(payload.endDate !== undefined && { endDate }),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "SPRINT_UPDATED",
      meta: { organizationId, projectId, sprintId, changes: payload },
    },
  });

  return updated;
};

const activateSprint = async (
  userId: string,
  organizationId: string,
  projectId: string,
  sprintId: string,
) => {
  await ensureOrgMembership(userId, organizationId, true);
  await ensureProject(organizationId, projectId);
  const sprint = await ensureSprint(projectId, sprintId);

  if (sprint.status === SprintStatus.ACTIVE) {
    throw new AppError(httpStatus.BAD_REQUEST, "Sprint is already ACTIVE");
  }
  if (sprint.status === SprintStatus.COMPLETED) {
    throw new AppError(httpStatus.BAD_REQUEST, "COMPLETED sprints cannot be re-activated");
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.sprint.updateMany({
      where: { projectId, status: SprintStatus.ACTIVE, deletedAt: null },
      data: { status: SprintStatus.COMPLETED },
    });

    const activated = await tx.sprint.update({
      where: { id: sprintId },
      data: { status: SprintStatus.ACTIVE },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "SPRINT_ACTIVATED",
        meta: { organizationId, projectId, sprintId },
      },
    });

    return activated;
  });

  return result;
};

export const SprintService = {
  createSprint,
  listSprints,
  getSprintById,
  updateSprint,
  activateSprint,
};
