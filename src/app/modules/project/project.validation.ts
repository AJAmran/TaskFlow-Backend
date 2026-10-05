import { z } from "zod";
import { ProjectStatus } from "../../../generated/prisma/enums";

const optionalDate = (message: string) =>
	z.string().datetime({ message: "Must be a valid ISO datetime" }).optional();

export const ProjectValidation = {
	createProjectSchema: z
		.object({
			name: z
				.string({ message: "Project name is required" })
				.min(2, "Name must be at least 2 characters")
				.max(100, "Name cannot exceed 100 characters")
				.trim(),
			description: z
				.string()
				.max(2000, "Description cannot exceed 2000 characters")
				.trim()
				.optional(),
			startDate: optionalDate("startDate must be a valid ISO datetime"),
			endDate: optionalDate("endDate must be a valid ISO datetime"),
			teamId: z.string().uuid("teamId must be a valid UUID").optional(),
		})
		.refine(
			(data) =>
				data.startDate === undefined ||
				data.endDate === undefined ||
				new Date(data.startDate) < new Date(data.endDate),
			{
				message: "startDate must be before endDate",
				path: ["endDate"],
			},
		),

	updateProjectSchema: z
		.object({
			name: z
				.string()
				.min(2, "Name must be at least 2 characters")
				.max(100, "Name cannot exceed 100 characters")
				.trim()
				.optional(),
			description: z
				.string()
				.max(2000, "Description cannot exceed 2000 characters")
				.trim()
				.nullable()
				.optional(),
			startDate: optionalDate("startDate must be a valid ISO datetime").nullable(),
			endDate: optionalDate("endDate must be a valid ISO datetime").nullable(),
			status: z.nativeEnum(ProjectStatus).optional(),
			teamId: z
				.string()
				.uuid("teamId must be a valid UUID")
			.nullable()
				.optional(),
		})
		.refine(
			(data) =>
				data.startDate === undefined ||
				data.endDate === undefined ||
				!data.startDate ||
				!data.endDate ||
				new Date(data.startDate) < new Date(data.endDate),
			{
				message: "startDate must be before endDate",
				path: ["endDate"],
			},
		),

	addProjectMemberSchema: z.object({
		userId: z
			.string({ message: "userId is required" })
			.uuid("userId must be a valid UUID"),
	}),

	listMembersQuerySchema: z.object({
		page: z.coerce.number().int().positive().optional().default(1),
		limit: z.coerce.number().int().positive().max(100).optional().default(10),
	}),

	listProjectsQuerySchema: z.object({
		page: z.coerce.number().int().positive().optional().default(1),
		limit: z.coerce.number().int().positive().max(100).optional().default(10),
		status: z.nativeEnum(ProjectStatus).optional(),
		teamId: z.string().uuid("teamId must be a valid UUID").optional(),
		search: z.string().trim().max(100).optional(),
		sortBy: z
			.enum(["createdAt", "updatedAt", "name"])
			.optional()
			.default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
	}),
};
