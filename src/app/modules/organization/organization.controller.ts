import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { OrganizationService } from "./organization.service";

const createOrganization = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const result = await OrganizationService.createOrganization(user.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Organization created successfully",
    data: result,
  });
});

const getMyOrganizations = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const result = await OrganizationService.getMyOrganizations(user.userId, req.query as { page?: number; limit?: number });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organizations fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getOrganizationById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId } = req.params;
  const result = await OrganizationService.getOrganizationById(user.userId, organizationId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organization fetched successfully",
    data: result,
  });
});

const updateOrganization = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId } = req.params;
  const result = await OrganizationService.updateOrganization(user.userId, organizationId as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organization updated successfully",
    data: result,
  });
});

const inviteMember = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId } = req.params;
  const result = await OrganizationService.inviteMember(user.userId, organizationId as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Invitation sent successfully",
    data: result,
  });
});

const acceptInvite = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const result = await OrganizationService.acceptInvite(user.userId, req.body.token);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Invitation accepted successfully",
    data: result,
  });
});

const listMembers = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId } = req.params;
  const result = await OrganizationService.listMembers(user.userId, organizationId as string, req.query as { page?: number; limit?: number });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Members fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const updateMemberRole = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, userId } = req.params;
  const result = await OrganizationService.updateMemberRole(
    user.userId,
    organizationId as string,
    userId as string,
    req.body.role,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Member role updated successfully",
    data: result,
  });
});

const removeMember = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, userId } = req.params;
  const result = await OrganizationService.removeMember(user.userId, organizationId as string, userId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Member removed successfully",
    data: result,
  });
});

export const OrganizationController = {
  createOrganization,
  getMyOrganizations,
  getOrganizationById,
  updateOrganization,
  inviteMember,
  acceptInvite,
  listMembers,
  updateMemberRole,
  removeMember,
};
