import { Router } from "express";
import { authenticate, requireOrgMembership } from "../../middleware/auth";
import { validateRequestWith } from "../../middleware/validateRequest";
import { DashboardController } from "./dashboard.controller";
import { DashboardValidation } from "./dashboard.validation";

const router = Router({ mergeParams: true });

router.get(
  "/:organizationId/dashboard",
  authenticate,
  requireOrgMembership,
  validateRequestWith({ params: DashboardValidation.dashboardParamsSchema }),
  DashboardController.getDashboard,
);

export const dashboardRoutes = router;
