import { Router } from "express";
import { authenticate, requireOrgMembership } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { TeamController } from "./team.controller";
import { TeamValidation } from "./team.validation";

const router = Router({ mergeParams: true });

// All team routes are organization-scoped — require membership
router.post(
  "/:organizationId/teams",
  authenticate,
  requireOrgMembership,
  validateRequest(TeamValidation.createTeamSchema),
  TeamController.createTeam,
);

router.get(
  "/:organizationId/teams",
  authenticate,
  requireOrgMembership,
  TeamController.listTeams,
);

router.get(
  "/:organizationId/teams/:teamId",
  authenticate,
  requireOrgMembership,
  TeamController.getTeamById,
);

router.patch(
  "/:organizationId/teams/:teamId",
  authenticate,
  requireOrgMembership,
  validateRequest(TeamValidation.updateTeamSchema),
  TeamController.updateTeam,
);

router.delete(
  "/:organizationId/teams/:teamId",
  authenticate,
  requireOrgMembership,
  TeamController.softDeleteTeam,
);

router.post(
  "/:organizationId/teams/:teamId/members",
  authenticate,
  requireOrgMembership,
  validateRequest(TeamValidation.addTeamMemberSchema),
  TeamController.addTeamMember,
);

router.get(
  "/:organizationId/teams/:teamId/members",
  authenticate,
  requireOrgMembership,
  TeamController.listTeamMembers,
);

router.delete(
  "/:organizationId/teams/:teamId/members/:userId",
  authenticate,
  requireOrgMembership,
  TeamController.removeTeamMember,
);

export const teamRoutes = router;
