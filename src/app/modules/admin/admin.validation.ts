import { z } from "zod";
import { OrganizationStatus, PlatformRole } from "../../../generated/prisma/enums";

const pageLimit = {
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
};

export type ListOrganizationsQuery = {
  page?: number;
  limit?: number;
  status?: OrganizationStatus;
};

export type ListUsersQuery = {
  page?: number;
  limit?: number;
  search?: string;
  platformRole?: PlatformRole;
  isActive?: boolean;
};

export type AuditLogsQuery = {
  page?: number;
  limit?: number;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
};

export const AdminValidation = {
  listOrganizationsQuerySchema: z.object({
    ...pageLimit,
    status: z.nativeEnum(OrganizationStatus).optional(),
  }),

  updateOrganizationStatusSchema: z.object({
    status: z.nativeEnum(OrganizationStatus),
  }),

  updateUserStatusSchema: z.object({
    isActive: z.boolean({ message: "isActive must be true or false" }),
  }),

  listUsersQuerySchema: z.object({
    ...pageLimit,
    search: z.string().trim().min(1).max(100).optional(),
    platformRole: z.nativeEnum(PlatformRole).optional(),
    isActive: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .transform((v) => (typeof v === "string" ? v === "true" : v))
      .optional(),
  }),

  auditLogsQuerySchema: z.object({
    ...pageLimit,
    action: z.string().trim().min(1).max(100).optional(),
    userId: z.string().min(1).optional(),
    from: z.string().datetime({ message: "Must be a valid ISO datetime" }).optional(),
    to: z.string().datetime({ message: "Must be a valid ISO datetime" }).optional(),
  }),
};
