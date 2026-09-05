import { z } from "zod";
import { OrgRole } from "../../../generated/prisma/enums";

export const OrganizationValidation = {
  createOrganizationSchema: z.object({
    name: z
      .string({ message: "Organization name is required" })
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters")
      .trim(),
    slug: z
      .string()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
  }),

  updateOrganizationSchema: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100)
      .trim()
      .optional(),
    slug: z
      .string()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
  }),

  inviteMemberSchema: z.object({
	email: z
		.string({ message: "Email is required" })
		.trim()
		.toLowerCase()
		.pipe(z.email("Invalid email format")),
    role: z.nativeEnum(OrgRole).optional().default(OrgRole.MEMBER),
  }),

  acceptInviteSchema: z.object({
    token: z.string({ message: "Invite token is required" }).min(1, "Token is required").trim(),
  }),

  updateMemberRoleSchema: z.object({
    role: z.nativeEnum(OrgRole, { message: "Role must be ORG_OWNER or MEMBER" }),
  }),

  paginationQuerySchema: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
  }),
};
