import { z } from "zod";

export const TeamValidation = {
  createTeamSchema: z.object({
    name: z
      .string({ message: "Team name is required" })
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters")
      .trim(),
  }),

  updateTeamSchema: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters")
      .trim()
      .optional(),
  }),

  addTeamMemberSchema: z.object({
    userId: z.string({ message: "userId is required" }).uuid("userId must be a valid UUID"),
  }),
};
