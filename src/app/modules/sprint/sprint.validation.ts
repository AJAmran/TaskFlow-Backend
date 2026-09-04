import { z } from "zod";
import { SprintStatus } from "../../../generated/prisma/enums";

const dateSchema = (message: string) =>
  z.string({ message }).datetime({ message: "Must be a valid ISO datetime" });

export const SprintValidation = {
  createSprintSchema: z
    .object({
      name: z
        .string({ message: "Sprint name is required" })
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name cannot exceed 100 characters")
        .trim(),
      startDate: dateSchema("startDate is required"),
      endDate: dateSchema("endDate is required"),
    })
    .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
      message: "startDate must be before endDate",
      path: ["endDate"],
    }),

  updateSprintSchema: z
    .object({
      name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name cannot exceed 100 characters")
        .trim()
        .optional(),
      startDate: dateSchema("startDate must be a valid ISO datetime").optional(),
      endDate: dateSchema("endDate must be a valid ISO datetime").optional(),
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

  listSprintsQuerySchema: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    status: z.nativeEnum(SprintStatus).optional(),
  }),
};
