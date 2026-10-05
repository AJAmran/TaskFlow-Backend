import httpStatus from "http-status";
import type { ProjectStatus } from "../../../generated/prisma/enums";
import { assertOrgAccess } from "../../middleware/auth";
import { invalidateOrgDashboard } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { calculatePagination } from "../../utils/pagination";

const ensureOrgMembership = (
	userId: string,
	organizationId: string,
	requireOwner = false,
) => assertOrgAccess(userId, organizationId, { requireOwner });

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
	payload: {
		name: string;
		description?: string;
		teamId?: string;
		startDate?: Date;
		endDate?: Date;
	},
) => {
	const membership = await ensureOrgMembership(userId, organizationId);

	if (payload.teamId) {
		const team = await prisma.team.findFirst({
			where: { id: payload.teamId, organizationId, deletedAt: null },
		});
		if (!team)
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Team not found in this organization",
			);
	}

	const result = await prisma.$transaction(
		async (tx) => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;

			const subscription = await tx.subscription.findUnique({
				where: { organizationId },
			});
			if (!subscription)
				throw new AppError(
					httpStatus.NOT_FOUND,
					"Organization subscription not found",
				);

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
					...(payload.description !== undefined && {
						description: payload.description,
					}),
					...(payload.startDate && { startDate: payload.startDate }),
					...(payload.endDate && { endDate: payload.endDate }),
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
		},
		{ isolationLevel: "Serializable" },
	);

	await invalidateOrgDashboard(organizationId);

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
		search?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	},
) => {
	await ensureOrgMembership(userId, organizationId);

	const { page, limit, skip } = calculatePagination(query);
	const allowedSortBy = ["createdAt", "updatedAt", "name"];
	const sortBy = allowedSortBy.includes(query.sortBy || "")
		? (query.sortBy as string)
		: "createdAt";
	const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

	const search = query.search?.trim();

	const where = {
		organizationId,
		deletedAt: null,
		...(query.status && { status: query.status }),
		...(query.teamId && { teamId: query.teamId }),
		...(search && {
			OR: [
				{ name: { contains: search, mode: "insensitive" as const } },
				{
					description: {
						contains: search,
						mode: "insensitive" as const,
					},
				},
			],
		}),
	};

	const [projects, total] = await Promise.all([
		prisma.project.findMany({
			where,
			include: {
				team: { where: { deletedAt: null }, select: { id: true, name: true } },
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

	return {
		data: projects,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getProjectById = async (
	userId: string,
	organizationId: string,
	projectId: string,
) => {
	await ensureOrgMembership(userId, organizationId);
	const project = await prisma.project.findFirst({
		where: { id: projectId, organizationId, deletedAt: null },
		include: {
			team: { where: { deletedAt: null }, select: { id: true, name: true } },
			members: {
				include: {
					user: {
						select: { id: true, name: true, email: true, profileImage: true },
					},
				},
				take: 200,
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
	payload: {
		name?: string;
		description?: string | null;
		status?: ProjectStatus;
		teamId?: string | null;
		startDate?: Date | null;
		endDate?: Date | null;
	},
) => {
	await ensureOrgMembership(userId, organizationId);
	const current = await ensureProject(organizationId, projectId);

	const nextStart =
		payload.startDate !== undefined ? payload.startDate : current.startDate;
	const nextEnd =
		payload.endDate !== undefined ? payload.endDate : current.endDate;
	if (nextStart && nextEnd && nextStart >= nextEnd) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"startDate must be before endDate",
		);
	}

	if (payload.teamId !== undefined && payload.teamId !== null) {
		const team = await prisma.team.findFirst({
			where: { id: payload.teamId, organizationId, deletedAt: null },
		});
		if (!team)
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Team not found in this organization",
			);
	}

	const updated = await prisma.$transaction(async (tx) => {
		const project = await tx.project.update({
			where: { id: projectId },
			data: {
				...(payload.name !== undefined && { name: payload.name.trim() }),
				...(payload.description !== undefined && {
					description: payload.description,
				}),
				...(payload.status !== undefined && { status: payload.status }),
				...(payload.teamId !== undefined && { teamId: payload.teamId }),
				...(payload.startDate !== undefined && {
					startDate: payload.startDate,
				}),
				...(payload.endDate !== undefined && { endDate: payload.endDate }),
			},
		});

		await tx.activityLog.create({
			data: {
				userId,
				action: "PROJECT_UPDATED",
				meta: { organizationId, projectId, changes: payload },
			},
		});

		return project;
	});

	await invalidateOrgDashboard(organizationId);

	return updated;
};

const softDeleteProject = async (
	userId: string,
	organizationId: string,
	projectId: string,
) => {
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

		await tx.comment.updateMany({
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

	await invalidateOrgDashboard(organizationId);

	return result;
};

const addProjectMember = async (
	userId: string,
	organizationId: string,
	projectId: string,
	targetUserId: string,
) => {
	await ensureOrgMembership(userId, organizationId, true);
	await ensureProject(organizationId, projectId);

	const orgMember = await prisma.organizationMember.findFirst({
		where: { organizationId, userId: targetUserId, deletedAt: null },
	});
	if (!orgMember) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Target user is not a member of this organization",
		);
	}

	const userExists = await prisma.user.findFirst({
		where: { id: targetUserId, deletedAt: null },
	});
	if (!userExists) throw new AppError(httpStatus.NOT_FOUND, "User not found");

	const existing = await prisma.projectMember.findUnique({
		where: { projectId_userId: { projectId, userId: targetUserId } },
	});
	if (existing)
		throw new AppError(
			httpStatus.CONFLICT,
			"User is already a member of this project",
		);

	const member = await prisma.projectMember.create({
		data: { projectId, userId: targetUserId, role: orgMember.role },
	});

	await prisma.activityLog.create({
		data: {
			userId,
			action: "PROJECT_MEMBER_ADDED",
			meta: { organizationId, projectId, targetUserId, role: member.role },
		},
	});

	await invalidateOrgDashboard(organizationId);

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
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						profileImage: true,
						platformRole: true,
					},
				},
			},
			skip,
			take: limit,
			orderBy: { user: { name: "asc" } },
		}),
		prisma.projectMember.count({ where }),
	]);

	return {
		data: members,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const removeProjectMember = async (
	userId: string,
	organizationId: string,
	projectId: string,
	targetUserId: string,
) => {
	await ensureOrgMembership(userId, organizationId, true);
	await ensureProject(organizationId, projectId);

	const member = await prisma.projectMember.findUnique({
		where: { projectId_userId: { projectId, userId: targetUserId } },
	});
	if (!member)
		throw new AppError(httpStatus.NOT_FOUND, "Project member not found");

	await prisma.$transaction(async (tx) => {
		await tx.projectMember.delete({
			where: { projectId_userId: { projectId, userId: targetUserId } },
		});

		const remaining = await tx.projectMember.count({ where: { projectId } });
		if (remaining === 0) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot remove the last member of the project",
			);
		}

		await tx.activityLog.create({
			data: {
				userId,
				action: "PROJECT_MEMBER_REMOVED",
				meta: { organizationId, projectId, targetUserId },
			},
		});
	});

	await invalidateOrgDashboard(organizationId);

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
