import httpStatus from "http-status";
import { OrgRole, type ProjectStatus } from "../../../generated/prisma/enums";
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

const createProject = async (
  userId: string,
  organizationId: string,
  payload: { name: string; description?: string; teamId?: string },
) => {
  const membership = await ensureOrgMembership(userId, organizationId);

  if (payload.teamId) {
    const team = await prisma.team.findFirst({
      where: { id: payload.teamId, organizationId, deletedAt: null },
    });
    if (!team) throw new AppError(httpStatus.BAD_REQUEST, "Team not found in this organization");
  }

  const result = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({ where: { organizationId } });
    if (!subscription) throw new AppError(httpStatus.NOT_FOUND, "Organization subscription not found");

    const projectCount = await tx.project.count({
      where: { organizationId, deletedAt: null },
    });
    if (projectCount >= subscription.maxProjects) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        `Project limit reached (${subscription.maxProjects}) for ${subscription.plan} plan. Please upgrade.`,
      );
    }

    const project = await tx.project.create({
      data: {
        organizationId,
        name: payload.name.trim(),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.teamId && { teamId: payload.teamId }),
      },
    });

    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId,
        role: membership.role,
      },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "PROJECT_CREATED",
        meta: { organizationId, projectId: project.id, name: project.name },
      },
    });

    return project;
  });

  return result;
};

const listProjects = async (
  userId: string,
  organizationId: string,
  query: {
    page?: number;
    limit?: number;
    status?: ProjectStatus;
    teamId?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  },
) => {
  await ensureOrgMembership(userId, organizationId);

  const { page, limit, skip } = calculatePagination(query);
  const allowedSortBy = ["createdAt", "updatedAt", "name"];
  const sortBy = allowedSortBy.includes(query.sortBy || "") ? (query.sortBy as string) : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const where = {
    organizationId,
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.teamId && { teamId: query.teamId }),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        team: { select: { id: true, name: true } },
        _count: {
          select: {
            members: true,
            sprints: { where: { deletedAt: null } },
            tasks: { where: { deletedAt: null } },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.project.count({ where }),
  ]);

  return { data: projects, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getProjectById = async (userId: string, organizationId: string, projectId: string) => {
  await ensureOrgMembership(userId, organizationId);
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    include: {
      team: { select: { id: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, profileImage: true } },
        },
      },
      _count: {
        select: {
          sprints: { where: { deletedAt: null } },
          tasks: { where: { deletedAt: null } },
        },
      },
    },
  });
  if (!project) throw new AppError(httpStatus.NOT_FOUND, "Project not found");
  return project;
};

const updateProject = async (
  userId: string,
  organizationId: string,
  projectId: string,
  payload: { name?: string; description?: string | null; status?: ProjectStatus; teamId?: string | null },
) => {
  await ensureOrgMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);

  if (payload.teamId !== undefined && payload.teamId !== null) {
    const team = await prisma.team.findFirst({
      where: { id: payload.teamId, organizationId, deletedAt: null },
    });
    if (!team) throw new AppError(httpStatus.BAD_REQUEST, "Team not found in this organization");
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.status !== undefined && { status: payload.status }),
      ...(payload.teamId !== undefined && { teamId: payload.teamId }),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "PROJECT_UPDATED",
      meta: { organizationId, projectId, changes: payload },
    },
  });

  return updated;
};

const softDeleteProject = async (userId: string, organizationId: string, projectId: string) => {
  await ensureOrgMembership(userId, organizationId, true);
  await ensureProject(organizationId, projectId);

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: projectId },
      data: { deletedAt: now },
    });

    await tx.sprint.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt: now },
    });

    await tx.task.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt: now },
    });

    await tx.subtask.updateMany({
      where: { task: { projectId }, deletedAt: null },
      data: { deletedAt: now },
    });

    await tx.activityLog.create({
      data: {
        userId,
        action: "PROJECT_DELETED",
        meta: { organizationId, projectId },
      },
    });

    return project;
  });

  return result;
};

const addProjectMember = async (
  userId: string,
  organizationId: string,
  projectId: string,
  targetUserId: string,
  role?: OrgRole,
) => {
  await ensureOrgMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);

  const orgMember = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });
  if (!orgMember || orgMember.deletedAt) {
    throw new AppError(httpStatus.BAD_REQUEST, "Target user is not a member of this organization");
  }

  const userExists = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null } });
  if (!userExists) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });
  if (existing) throw new AppError(httpStatus.CONFLICT, "User is already a member of this project");

  const member = await prisma.projectMember.create({
    data: { projectId, userId: targetUserId, role: role || orgMember.role },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "PROJECT_MEMBER_ADDED",
      meta: { organizationId, projectId, targetUserId, role: member.role },
    },
  });

  return member;
};

const listProjectMembers = async (
  userId: string,
  organizationId: string,
  projectId: string,
  query: { page?: number; limit?: number },
) => {
  await ensureOrgMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);

  const { page, limit, skip } = calculatePagination(query);
  const where = { projectId };

  const [members, total] = await Promise.all([
    prisma.projectMember.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, profileImage: true, platformRole: true } },
      },
      skip,
      take: limit,
      orderBy: { user: { name: "asc" } },
    }),
    prisma.projectMember.count({ where }),
  ]);

  return { data: members, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const removeProjectMember = async (
  userId: string,
  organizationId: string,
  projectId: string,
  targetUserId: string,
) => {
  await ensureOrgMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });
  if (!member) throw new AppError(httpStatus.NOT_FOUND, "Project member not found");

  const memberCount = await prisma.projectMember.count({ where: { projectId } });
  if (memberCount <= 1) {
    throw new AppError(httpStatus.BAD_REQUEST, "Cannot remove the last member of the project");
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId: targetUserId } },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "PROJECT_MEMBER_REMOVED",
      meta: { organizationId, projectId, targetUserId },
    },
  });

  return null;
};

export const ProjectService = {
  createProject,
  listProjects,
  getProjectById,
  updateProject,
  softDeleteProject,
  addProjectMember,
  listProjectMembers,
  removeProjectMember,
};
