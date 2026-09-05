import { z } from "zod";

export const UserValidation = {
  updateProfileSchema: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name must be at most 50 characters")
      .trim()
      .optional(),
    profileImage: z.string().url("profileImage must be a valid URL").max(500).optional(),
  }),
};
