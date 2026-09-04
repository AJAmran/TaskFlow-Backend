import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TeamService } from "./team.service";

const createTeam = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId } = req.params;
  const result = await TeamService.createTeam(user.userId, organizationId as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Team created successfully",
    data: result,
  });
});

const listTeams = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId } = req.params;
  const result = await TeamService.listTeams(user.userId, organizationId as string, req.query as { page?: number; limit?: number });
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Teams fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getTeamById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, teamId } = req.params;
  const result = await TeamService.getTeamById(user.userId, organizationId as string, teamId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team fetched successfully",
    data: result,
  });
});

const updateTeam = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, teamId } = req.params;
  const result = await TeamService.updateTeam(user.userId, organizationId as string, teamId as string, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team updated successfully",
    data: result,
  });
});

const softDeleteTeam = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, teamId } = req.params;
  const result = await TeamService.softDeleteTeam(user.userId, organizationId as string, teamId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team deleted successfully",
    data: result,
  });
});

const addTeamMember = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, teamId } = req.params;
  const result = await TeamService.addTeamMember(user.userId, organizationId as string, teamId as string, req.body.userId);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Team member added successfully",
    data: result,
  });
});

const listTeamMembers = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, teamId } = req.params;
  const result = await TeamService.listTeamMembers(
    user.userId,
    organizationId as string,
    teamId as string,
    req.query as { page?: number; limit?: number },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team members fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const removeTeamMember = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, teamId, userId } = req.params;
  await TeamService.removeTeamMember(user.userId, organizationId as string, teamId as string, userId as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Team member removed successfully",
    data: null,
  });
});

export const TeamController = {
  createTeam,
  listTeams,
  getTeamById,
  updateTeam,
  softDeleteTeam,
  addTeamMember,
  listTeamMembers,
  removeTeamMember,
};
