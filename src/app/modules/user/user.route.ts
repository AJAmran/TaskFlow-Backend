import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

router.get("/me", authenticate, UserController.getProfile);

router.patch(
  "/me",
  authenticate,
  validateRequest(UserValidation.updateProfileSchema),
  UserController.updateProfile,
);

export const userRoutes = router;
