import { Router } from "express";
import { authenticate, requireSuperAdmin } from "../../middleware/auth";
import { validateRequest, validateRequestWith } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import { AdminValidation } from "./admin.validation";

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get(
  "/organizations",
  validateRequestWith({ query: AdminValidation.listOrganizationsQuerySchema }),
  AdminController.listOrganizations,
);

router.patch(
  "/organizations/:id/status",
  validateRequest(AdminValidation.updateOrganizationStatusSchema),
  AdminController.updateOrganizationStatus,
);

router.get(
  "/users",
  validateRequestWith({ query: AdminValidation.listUsersQuerySchema }),
  AdminController.listUsers,
);

router.get("/dashboard-stats", AdminController.dashboardStats);

router.get(
  "/audit-logs",
  validateRequestWith({ query: AdminValidation.auditLogsQuerySchema }),
  AdminController.auditLogs,
);

export const adminRoutes = router;
