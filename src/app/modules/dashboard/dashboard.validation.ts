import { z } from "zod";

export const dashboardParamsSchema = z.object({
  organizationId: z.string().min(1, "organizationId is required"),
});

export const DashboardValidation = {
  dashboardParamsSchema,
};
