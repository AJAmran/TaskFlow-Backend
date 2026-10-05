import httpStatus from "http-status";
import { SprintStatus } from "../../../generated/prisma/enums";
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
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"startDate must be before endDate",
		);
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
			meta: {
				organizationId,
				projectId,
				sprintId: sprint.id,
				name: sprint.name,
			},
		},
	});

	await invalidateOrgDashboard(organizationId);

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
			include: {
				_count: { select: { tasks: { where: { deletedAt: null } } } },
			},
			skip,
			take: limit,
			orderBy: { startDate: "asc" },
		}),
		prisma.sprint.count({ where }),
	]);

	return {
		data: sprints,
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
	};
};

const getSprintById = async (
	userId: string,
	organizationId: string,
	projectId: string,
	sprintId: string,
) => {
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

	const startDate =
		payload.startDate !== undefined
			? new Date(payload.startDate)
			: sprint.startDate;
	const endDate =
		payload.endDate !== undefined ? new Date(payload.endDate) : sprint.endDate;
	if (startDate >= endDate) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"startDate must be before endDate",
		);
	}

	const applied = await prisma.sprint.updateMany({
		where: { id: sprintId, status: SprintStatus.PLANNED, deletedAt: null },
		data: {
			...(payload.name !== undefined && { name: payload.name.trim() }),
			...(payload.startDate !== undefined && { startDate }),
			...(payload.endDate !== undefined && { endDate }),
		},
	});
	if (applied.count === 0) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Sprint was changed by someone else. Reload and try again.",
		);
	}

	const updated = await prisma.sprint.findUnique({ where: { id: sprintId } });
	if (!updated) throw new AppError(httpStatus.NOT_FOUND, "Sprint not found");

	await prisma.activityLog.create({
		data: {
			userId,
			action: "SPRINT_UPDATED",
			meta: { organizationId, projectId, sprintId, changes: payload },
		},
	});

	await invalidateOrgDashboard(organizationId);

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
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"COMPLETED sprints cannot be re-activated",
		);
	}

	const result = await prisma.$transaction(
		async (tx) => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sprint-activate-${projectId}`}))`;

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
		},
		{ isolationLevel: "Serializable" },
	);

	await invalidateOrgDashboard(organizationId);

	return result;
};

const completeSprint = async (
	userId: string,
	organizationId: string,
	projectId: string,
	sprintId: string,
) => {
	await ensureOrgMembership(userId, organizationId, true);
	await ensureProject(organizationId, projectId);
	const sprint = await ensureSprint(projectId, sprintId);

	if (sprint.status !== SprintStatus.ACTIVE) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Only ACTIVE sprints can be completed. Current status: ${sprint.status}`,
		);
	}

	const completed = await prisma.sprint.updateMany({
		where: { id: sprintId, status: SprintStatus.ACTIVE, deletedAt: null },
		data: { status: SprintStatus.COMPLETED },
	});
	if (completed.count === 0) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Sprint was changed by someone else. Reload and try again.",
		);
	}

	const updated = await prisma.sprint.findUnique({ where: { id: sprintId } });
	if (!updated) throw new AppError(httpStatus.NOT_FOUND, "Sprint not found");

	await prisma.activityLog.create({
		data: {
			userId,
			action: "SPRINT_COMPLETED",
			meta: { organizationId, projectId, sprintId },
		},
	});

	await invalidateOrgDashboard(organizationId);

	return updated;
};

export const SprintService = {
	createSprint,
	listSprints,
	getSprintById,
	updateSprint,
	activateSprint,
	completeSprint,
};
