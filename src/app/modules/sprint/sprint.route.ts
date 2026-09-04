import { Router } from "express";
import { OrgRole } from "../../../generated/prisma/enums";
import { authenticate, requireOrgMembership, requireRole } from "../../middleware/auth";
import { validateRequest, validateRequestWith } from "../../middleware/validateRequest";
import { SprintController } from "./sprint.controller";
import { SprintValidation } from "./sprint.validation";

const router = Router({ mergeParams: true });

router.post(
  "/:organizationId/projects/:projectId/sprints",
  authenticate,
  requireOrgMembership,
  validateRequest(SprintValidation.createSprintSchema),
  SprintController.createSprint,
);

router.get(
  "/:organizationId/projects/:projectId/sprints",
  authenticate,
  requireOrgMembership,
  validateRequestWith({ query: SprintValidation.listSprintsQuerySchema }),
  SprintController.listSprints,
);

router.get(
  "/:organizationId/projects/:projectId/sprints/:sprintId",
  authenticate,
  requireOrgMembership,
  SprintController.getSprintById,
);

router.patch(
  "/:organizationId/projects/:projectId/sprints/:sprintId",
  authenticate,
  requireOrgMembership,
  validateRequest(SprintValidation.updateSprintSchema),
  SprintController.updateSprint,
);

router.post(
  "/:organizationId/projects/:projectId/sprints/:sprintId/activate",
  authenticate,
  requireOrgMembership,
  requireRole(OrgRole.ORG_OWNER),
  SprintController.activateSprint,
);

export const sprintRoutes = router;
