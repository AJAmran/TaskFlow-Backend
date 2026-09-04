import { Router } from "express";
import { authenticate, requireOrgMembership, requireRole } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { OrgRole } from "../../../generated/prisma/enums";
import { OrganizationController } from "./organization.controller";
import { OrganizationValidation } from "./organization.validation";

const router = Router();

// Create organization & list my orgs — only authentication required
router.post(
  "/",
  authenticate,
  validateRequest(OrganizationValidation.createOrganizationSchema),
  OrganizationController.createOrganization,
);

router.get("/", authenticate, OrganizationController.getMyOrganizations);

// Accept invite — must be authenticated but no org membership required
router.post(
  "/invitations/accept",
  authenticate,
  validateRequest(OrganizationValidation.acceptInviteSchema),
  OrganizationController.acceptInvite,
);

// Org-scoped routes
router.get(
  "/:organizationId",
  authenticate,
  requireOrgMembership,
  OrganizationController.getOrganizationById,
);

router.patch(
  "/:organizationId",
  authenticate,
  requireOrgMembership,
  requireRole(OrgRole.ORG_OWNER),
  validateRequest(OrganizationValidation.updateOrganizationSchema),
  OrganizationController.updateOrganization,
);

router.post(
  "/:organizationId/invite",
  authenticate,
  requireOrgMembership,
  requireRole(OrgRole.ORG_OWNER),
  validateRequest(OrganizationValidation.inviteMemberSchema),
  OrganizationController.inviteMember,
);

router.get(
  "/:organizationId/members",
  authenticate,
  requireOrgMembership,
  OrganizationController.listMembers,
);

router.patch(
  "/:organizationId/members/:userId",
  authenticate,
  requireOrgMembership,
  requireRole(OrgRole.ORG_OWNER),
  validateRequest(OrganizationValidation.updateMemberRoleSchema),
  OrganizationController.updateMemberRole,
);

router.delete(
  "/:organizationId/members/:userId",
  authenticate,
  requireOrgMembership,
  requireRole(OrgRole.ORG_OWNER),
  OrganizationController.removeMember,
);

export const organizationRoutes = router;
