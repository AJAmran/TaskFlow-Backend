import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { calculatePagination } from "../../utils/pagination";
import { OrgRole } from "../../../generated/prisma/enums";

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

const createTeam = async (userId: string, organizationId: string, payload: { name: string }) => {
  await ensureOrgMembership(userId, organizationId);

  const team = await prisma.team.create({
    data: {
      organizationId,
      name: payload.name.trim(),
    },
  });

  await prisma.activityLog.create({
    data: { userId, action: "TEAM_CREATED", meta: { organizationId, teamId: team.id, name: team.name } },
  });

  return team;
};

const listTeams = async (userId: string, organizationId: string, query: { page?: number; limit?: number }) => {
  await ensureOrgMembership(userId, organizationId);
  const { page, limit, skip } = calculatePagination(query);
  const where = { organizationId, deletedAt: null };

  const [teams, total] = await Promise.all([
    prisma.team.findMany({
      where,
      include: { _count: { select: { members: true } } },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.count({ where }),
  ]);

  return { data: teams, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const getTeamById = async (userId: string, organizationId: string, teamId: string) => {
  await ensureOrgMembership(userId, organizationId);

  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId, deletedAt: null },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, profileImage: true } } } },
      _count: { select: { members: true } },
    },
  });
  if (!team) throw new AppError(httpStatus.NOT_FOUND, "Team not found");
  return team;
};

const updateTeam = async (userId: string, organizationId: string, teamId: string, payload: { name?: string }) => {
  await ensureOrgMembership(userId, organizationId);

  const team = await prisma.team.findFirst({ where: { id: teamId, organizationId, deletedAt: null } });
  if (!team) throw new AppError(httpStatus.NOT_FOUND, "Team not found");

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { ...(payload.name && { name: payload.name.trim() }) },
  });

  await prisma.activityLog.create({
    data: { userId, action: "TEAM_UPDATED", meta: { organizationId, teamId, changes: payload } },
  });

  return updated;
};

const softDeleteTeam = async (userId: string, organizationId: string, teamId: string) => {
  await ensureOrgMembership(userId, organizationId, true);

  const team = await prisma.team.findFirst({ where: { id: teamId, organizationId, deletedAt: null } });
  if (!team) throw new AppError(httpStatus.NOT_FOUND, "Team not found");

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { deletedAt: new Date() },
  });

  await prisma.activityLog.create({
    data: { userId, action: "TEAM_DELETED", meta: { organizationId, teamId } },
  });

  return updated;
};

const addTeamMember = async (userId: string, organizationId: string, teamId: string, targetUserId: string) => {
  await ensureOrgMembership(userId, organizationId);

  const team = await prisma.team.findFirst({ where: { id: teamId, organizationId, deletedAt: null } });
  if (!team) throw new AppError(httpStatus.NOT_FOUND, "Team not found");

  // target must be org member
  const orgMember = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });
  if (!orgMember || orgMember.deletedAt) {
    throw new AppError(httpStatus.BAD_REQUEST, "Target user is not a member of this organization");
  }

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  });
  if (existing) throw new AppError(httpStatus.CONFLICT, "User is already a member of this team");

  // ensure user exists and not deleted
  const userExists = await prisma.user.findFirst({ where: { id: targetUserId, deletedAt: null } });
  if (!userExists) throw new AppError(httpStatus.NOT_FOUND, "User not found");

  const teamMember = await prisma.teamMember.create({
    data: { teamId, userId: targetUserId },
  });

  await prisma.activityLog.create({
    data: { userId, action: "TEAM_MEMBER_ADDED", meta: { organizationId, teamId, targetUserId } },
  });

  return teamMember;
};

const listTeamMembers = async (userId: string, organizationId: string, teamId: string, query: { page?: number; limit?: number }) => {
  await ensureOrgMembership(userId, organizationId);

  const team = await prisma.team.findFirst({ where: { id: teamId, organizationId, deletedAt: null } });
  if (!team) throw new AppError(httpStatus.NOT_FOUND, "Team not found");

  const { page, limit, skip } = calculatePagination(query);
  const where = { teamId };

  const [members, total] = await Promise.all([
    prisma.teamMember.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, profileImage: true, platformRole: true } } },
      skip,
      take: limit,
      orderBy: { user: { name: "asc" } },
    }),
    prisma.teamMember.count({ where }),
  ]);

  return { data: members, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

const removeTeamMember = async (userId: string, organizationId: string, teamId: string, targetUserId: string) => {
  await ensureOrgMembership(userId, organizationId);

  const team = await prisma.team.findFirst({ where: { id: teamId, organizationId, deletedAt: null } });
  if (!team) throw new AppError(httpStatus.NOT_FOUND, "Team not found");

  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  });
  if (!member) throw new AppError(httpStatus.NOT_FOUND, "Team member not found");

  await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId: targetUserId } } });

  await prisma.activityLog.create({
    data: { userId, action: "TEAM_MEMBER_REMOVED", meta: { organizationId, teamId, targetUserId } },
  });

  return null;
};

export const TeamService = {
  createTeam,
  listTeams,
  getTeamById,
  updateTeam,
  softDeleteTeam,
  addTeamMember,
  listTeamMembers,
  removeTeamMember,
};
