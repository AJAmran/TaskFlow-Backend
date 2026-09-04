import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { SprintService } from "./sprint.service";

const createSprint = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId } = req.params;
  const result = await SprintService.createSprint(
    user.userId,
    organizationId as string,
    projectId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Sprint created successfully",
    data: result,
  });
});

const listSprints = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId } = req.params;
  const result = await SprintService.listSprints(
    user.userId,
    organizationId as string,
    projectId as string,
    req.query as { page?: number; limit?: number },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprints fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getSprintById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, sprintId } = req.params;
  const result = await SprintService.getSprintById(
    user.userId,
    organizationId as string,
    projectId as string,
    sprintId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprint fetched successfully",
    data: result,
  });
});

const updateSprint = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, sprintId } = req.params;
  const result = await SprintService.updateSprint(
    user.userId,
    organizationId as string,
    projectId as string,
    sprintId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprint updated successfully",
    data: result,
  });
});

const activateSprint = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, sprintId } = req.params;
  const result = await SprintService.activateSprint(
    user.userId,
    organizationId as string,
    projectId as string,
    sprintId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sprint activated successfully",
    data: result,
  });
});

export const SprintController = {
  createSprint,
  listSprints,
  getSprintById,
  updateSprint,
  activateSprint,
};
