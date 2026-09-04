import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ProjectService } from "./project.service";

const createProject = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId } = req.params;
  const result = await ProjectService.createProject(user.userId, organizationId as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Project created successfully",
    data: result,
  });
});

const listProjects = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId } = req.params;
  const result = await ProjectService.listProjects(
    user.userId,
    organizationId as string,
    req.query as { page?: number; limit?: number },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Projects fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getProjectById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId } = req.params;
  const result = await ProjectService.getProjectById(
    user.userId,
    organizationId as string,
    projectId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project fetched successfully",
    data: result,
  });
});

const updateProject = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId } = req.params;
  const result = await ProjectService.updateProject(
    user.userId,
    organizationId as string,
    projectId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project updated successfully",
    data: result,
  });
});

const softDeleteProject = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId } = req.params;
  const result = await ProjectService.softDeleteProject(
    user.userId,
    organizationId as string,
    projectId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project deleted successfully",
    data: result,
  });
});

const addProjectMember = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId } = req.params;
  const result = await ProjectService.addProjectMember(
    user.userId,
    organizationId as string,
    projectId as string,
    req.body.userId,
    req.body.role,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Project member added successfully",
    data: result,
  });
});

const listProjectMembers = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId } = req.params;
  const result = await ProjectService.listProjectMembers(
    user.userId,
    organizationId as string,
    projectId as string,
    req.query as { page?: number; limit?: number },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project members fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const removeProjectMember = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, userId } = req.params;
  await ProjectService.removeProjectMember(
    user.userId,
    organizationId as string,
    projectId as string,
    userId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project member removed successfully",
    data: null,
  });
});

export const ProjectController = {
  createProject,
  listProjects,
  getProjectById,
  updateProject,
  softDeleteProject,
  addProjectMember,
  listProjectMembers,
  removeProjectMember,
};
