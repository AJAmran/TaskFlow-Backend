import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TaskService } from "./task.service";
import type { ListTasksQuery } from "./task.validation";

const createTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId } = req.params;
  const result = await TaskService.createTask(
    user.userId,
    organizationId as string,
    projectId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Task created successfully",
    data: result,
  });
});

const listTasks = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId } = req.params;
  const result = await TaskService.listTasks(
    user.userId,
    organizationId as string,
    projectId as string,
    req.query as unknown as ListTasksQuery,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tasks fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const myAssigned = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId } = req.params;
  const result = await TaskService.myAssigned(
    user.userId,
    organizationId as string,
    req.query as { page?: number; limit?: number },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assigned tasks fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getTaskById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.getTaskById(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task fetched successfully",
    data: result,
  });
});

const updateTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.updateTask(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task updated successfully",
    data: result,
  });
});

const changeStatus = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.changeStatus(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    req.body.status,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task status updated successfully",
    data: result,
  });
});

const assignTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.assignTask(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    req.body.userId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task assigned successfully",
    data: result,
  });
});

const softDeleteTask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.softDeleteTask(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task deleted successfully",
    data: result,
  });
});

const createSubtask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.createSubtask(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Subtask created successfully",
    data: result,
  });
});

const listSubtasks = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.listSubtasks(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subtasks fetched successfully",
    data: result,
  });
});

const updateSubtask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId, subtaskId } = req.params;
  const result = await TaskService.updateSubtask(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    subtaskId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subtask updated successfully",
    data: result,
  });
});

const deleteSubtask = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId, subtaskId } = req.params;
  const result = await TaskService.deleteSubtask(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    subtaskId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Subtask deleted successfully",
    data: result,
  });
});

const createComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.createComment(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Comment added successfully",
    data: result,
  });
});

const listComments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.listComments(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    req.query as { page?: number; limit?: number },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comments fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId, commentId } = req.params;
  const result = await TaskService.deleteComment(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    commentId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Comment deleted successfully",
    data: result,
  });
});

const uploadAttachment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  if (!req.file) throw new AppError(httpStatus.BAD_REQUEST, "File is required");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.uploadAttachment(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    req.file,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Attachment uploaded successfully",
    data: result,
  });
});

const listAttachments = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId } = req.params;
  const result = await TaskService.listAttachments(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachments fetched successfully",
    data: result,
  });
});

const deleteAttachment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
  const { organizationId, projectId, taskId, attachmentId } = req.params;
  await TaskService.deleteAttachment(
    user.userId,
    organizationId as string,
    projectId as string,
    taskId as string,
    attachmentId as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attachment deleted successfully",
    data: null,
  });
});

export const TaskController = {
  createTask,
  listTasks,
  myAssigned,
  getTaskById,
  updateTask,
  changeStatus,
  assignTask,
  softDeleteTask,
  createSubtask,
  listSubtasks,
  updateSubtask,
  deleteSubtask,
  createComment,
  listComments,
  deleteComment,
  uploadAttachment,
  listAttachments,
  deleteAttachment,
};
