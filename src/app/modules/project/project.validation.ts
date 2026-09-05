import { z } from "zod";
import { OrgRole, ProjectStatus } from "../../../generated/prisma/enums";

export const ProjectValidation = {
  createProjectSchema: z.object({
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
    teamId: z.string().uuid("teamId must be a valid UUID").optional(),
  }),

  updateProjectSchema: z.object({
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
    status: z.nativeEnum(ProjectStatus).optional(),
    teamId: z.string().uuid("teamId must be a valid UUID").nullable().optional(),
  }),

  addProjectMemberSchema: z.object({
    userId: z.string({ message: "userId is required" }).uuid("userId must be a valid UUID"),
    role: z.nativeEnum(OrgRole).optional(),
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
    sortBy: z.enum(["createdAt", "updatedAt", "name"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
};
