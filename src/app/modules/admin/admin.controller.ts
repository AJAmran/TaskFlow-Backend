import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminService } from "./admin.service";
import type {
  AuditLogsQuery,
  ListOrganizationsQuery,
  ListUsersQuery,
} from "./admin.validation";

const listOrganizations = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const result = await AdminService.listOrganizations(req.query as unknown as ListOrganizationsQuery);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organizations fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const updateOrganizationStatus = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const result = await AdminService.updateOrganizationStatus(
    user.userId,
    req.params.id as string,
    req.body.status,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Organization ${result.status === "SUSPENDED" ? "suspended" : "activated"} successfully`,
    data: result,
  });
});

const listUsers = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const result = await AdminService.listUsers(req.query as unknown as ListUsersQuery);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const dashboardStats = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const result = await AdminService.dashboardStats();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard stats fetched successfully",
    data: result,
  });
});

const auditLogs = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const result = await AdminService.auditLogs(req.query as unknown as AuditLogsQuery);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

export const AdminController = {
  listOrganizations,
  updateOrganizationStatus,
  listUsers,
  dashboardStats,
  auditLogs,
};
