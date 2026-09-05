import { Router } from "express";
import { OrgRole } from "../../../generated/prisma/enums";
import { authenticate, requireOrgMembership, requireRole } from "../../middleware/auth";
import { validateRequest, validateRequestWith } from "../../middleware/validateRequest";
import { ProjectController } from "./project.controller";
import { ProjectValidation } from "./project.validation";

const router = Router({ mergeParams: true });

router.post(
  "/:organizationId/projects",
  authenticate,
  requireOrgMembership,
  validateRequest(ProjectValidation.createProjectSchema),
  ProjectController.createProject,
);

router.get(
  "/:organizationId/projects",
  authenticate,
  requireOrgMembership,
  validateRequestWith({ query: ProjectValidation.listProjectsQuerySchema }),
  ProjectController.listProjects,
);

router.get(
  "/:organizationId/projects/:projectId",
  authenticate,
  requireOrgMembership,
  ProjectController.getProjectById,
);

router.patch(
  "/:organizationId/projects/:projectId",
  authenticate,
  requireOrgMembership,
  validateRequest(ProjectValidation.updateProjectSchema),
  ProjectController.updateProject,
);

router.delete(
  "/:organizationId/projects/:projectId",
  authenticate,
  requireOrgMembership,
  requireRole(OrgRole.ORG_OWNER),
  ProjectController.softDeleteProject,
);

router.post(
  "/:organizationId/projects/:projectId/members",
  authenticate,
  requireOrgMembership,
  validateRequest(ProjectValidation.addProjectMemberSchema),
  ProjectController.addProjectMember,
);

router.get(
	"/:organizationId/projects/:projectId/members",
	authenticate,
	requireOrgMembership,
	validateRequestWith({ query: ProjectValidation.listMembersQuerySchema }),
	ProjectController.listProjectMembers,
);

router.delete(
  "/:organizationId/projects/:projectId/members/:userId",
  authenticate,
  requireOrgMembership,
  ProjectController.removeProjectMember,
);

export const projectRoutes = router;
