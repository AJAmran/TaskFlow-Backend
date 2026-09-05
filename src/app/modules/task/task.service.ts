import httpStatus from "http-status";
import { OrgRole, TaskPriority, TaskStatus } from "../../../generated/prisma/enums";
import { invalidateOrgDashboard } from "../../lib/cache";
import { deleteFromCloudinary, uploadBufferToCloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { buildPaginationMeta, calculatePagination } from "../../utils/pagination";
import type { ListTasksQuery } from "./task.validation";

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  [TaskStatus.TODO]: TaskStatus.IN_PROGRESS,
  [TaskStatus.IN_PROGRESS]: TaskStatus.IN_REVIEW,
  [TaskStatus.IN_REVIEW]: TaskStatus.DONE,
  [TaskStatus.DONE]: null,
};

const ensureMembership = async (userId: string, organizationId: string) => {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership || membership.deletedAt) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a member of this organization");
  }
  const org = await prisma.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
  if (!org) throw new AppError(httpStatus.NOT_FOUND, "Organization not found");
  return membership;
};

const ensureProject = async (organizationId: string, projectId: string) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
  });
  if (!project) throw new AppError(httpStatus.NOT_FOUND, "Project not found");
  return project;
};

const ensureTask = async (organizationId: string, projectId: string, taskId: string) => {
  await ensureProject(organizationId, projectId);
  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId, deletedAt: null },
  });
  if (!task) throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  return task;
};

const ensureAssigneeIsProjectMember = async (projectId: string, assigneeId: string) => {
  const [member, user] = await Promise.all([
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: assigneeId } },
    }),
    prisma.user.findFirst({ where: { id: assigneeId, deletedAt: null } }),
  ]);
  if (!user?.isActive) throw new AppError(httpStatus.BAD_REQUEST, "Assignee user not found or inactive");
  if (!member) throw new AppError(httpStatus.BAD_REQUEST, "Assignee must be a member of this project");
};

const ensureSprintInProject = async (projectId: string, sprintId: string) => {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId, deletedAt: null },
  });
  if (!sprint) throw new AppError(httpStatus.BAD_REQUEST, "Sprint not found in this project");
};

const createTask = async (
  userId: string,
  organizationId: string,
  projectId: string,
  payload: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    sprintId?: string;
    assigneeId?: string;
    dueDate?: string;
  },
) => {
  await ensureMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);

  if (payload.assigneeId) await ensureAssigneeIsProjectMember(projectId, payload.assigneeId);
  if (payload.sprintId) await ensureSprintInProject(projectId, payload.sprintId);

  const task = await prisma.task.create({
    data: {
      projectId,
      title: payload.title.trim(),
      ...(payload.description !== undefined && { description: payload.description }),
      priority: payload.priority ?? TaskPriority.MEDIUM,
      ...(payload.sprintId && { sprintId: payload.sprintId }),
      ...(payload.assigneeId && { assigneeId: payload.assigneeId }),
      ...(payload.dueDate && { dueDate: new Date(payload.dueDate) }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, profileImage: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      taskId: task.id,
      action: "TASK_CREATED",
      meta: { organizationId, projectId, taskId: task.id, assigneeId: payload.assigneeId ?? null },
    },
  });

  await invalidateOrgDashboard(organizationId);
  return task;
};

const listTasks = async (
  userId: string,
  organizationId: string,
  projectId: string,
  query: ListTasksQuery,
) => {
  await ensureMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);

  const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);
  const where = {
    projectId,
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.priority && { priority: query.priority }),
    ...(query.assigneeId && { assigneeId: query.assigneeId }),
    ...(query.sprintId && { sprintId: query.sprintId }),
    ...(query.q && {
      OR: [
        { title: { contains: query.q, mode: "insensitive" as const } },
        { description: { contains: query.q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true, profileImage: true } },
        sprint: { select: { id: true, name: true, status: true } },
        _count: { select: { subtasks: { where: { deletedAt: null } }, comments: { where: { deletedAt: null } } } },
      },
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.task.count({ where }),
  ]);

  return { data: tasks, meta: buildPaginationMeta(total, page, limit) };
};

const myAssigned = async (
  userId: string,
  organizationId: string,
  query: { page?: number; limit?: number; status?: TaskStatus },
) => {
  await ensureMembership(userId, organizationId);

  const { page, limit, skip } = calculatePagination(query);
  const where = {
    assigneeId: userId,
    deletedAt: null,
    project: { organizationId, deletedAt: null },
    ...(query.status && { status: query.status }),
  };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true, status: true } },
      },
      skip,
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.count({ where }),
  ]);

  return { data: tasks, meta: buildPaginationMeta(total, page, limit) };
};

const getTaskById = async (userId: string, organizationId: string, projectId: string, taskId: string) => {
  await ensureMembership(userId, organizationId);
  await ensureProject(organizationId, projectId);
  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId, deletedAt: null },
    include: {
      assignee: { select: { id: true, name: true, email: true, profileImage: true } },
      sprint: { select: { id: true, name: true, status: true } },
      subtasks: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      comments: {
        where: { deletedAt: null },
        include: { user: { select: { id: true, name: true, profileImage: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!task) throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  return task;
};

const updateTask = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  payload: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    sprintId?: string | null;
    dueDate?: string | null;
  },
) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  if (payload.sprintId !== undefined && payload.sprintId !== null) {
    await ensureSprintInProject(projectId, payload.sprintId);
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(payload.title !== undefined && { title: payload.title.trim() }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.priority !== undefined && { priority: payload.priority }),
      ...(payload.sprintId !== undefined && { sprintId: payload.sprintId }),
      ...(payload.dueDate !== undefined && {
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      }),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      taskId,
      action: "TASK_UPDATED",
      meta: { organizationId, projectId, taskId, changes: payload },
    },
  });

  await invalidateOrgDashboard(organizationId);
  return updated;
};

const changeStatus = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  status: TaskStatus,
) => {
  await ensureMembership(userId, organizationId);
  const task = await ensureTask(organizationId, projectId, taskId);

  if (task.status === status) return task;

  const allowed = NEXT_STATUS[task.status];
  if (allowed !== status) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid status transition from ${task.status} to ${status}. Allowed: ${allowed ?? "none (task is DONE)"}.`,
    );
  }

  const updated = await prisma.task.update({ where: { id: taskId }, data: { status } });

  await prisma.activityLog.create({
    data: {
      userId,
      taskId,
      action: "TASK_STATUS_CHANGED",
      meta: { organizationId, projectId, taskId, from: task.status, to: status },
    },
  });

  await invalidateOrgDashboard(organizationId);
  return updated;
};

const assignTask = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  assigneeId: string,
) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);
  await ensureAssigneeIsProjectMember(projectId, assigneeId);

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId },
    include: {
      assignee: { select: { id: true, name: true, email: true, profileImage: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      taskId,
      action: "TASK_ASSIGNED",
      meta: { organizationId, projectId, taskId, assigneeId },
    },
  });

  await invalidateOrgDashboard(organizationId);
  return updated;
};

const softDeleteTask = async (userId: string, organizationId: string, projectId: string, taskId: string) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.task.update({ where: { id: taskId }, data: { deletedAt: now } });
    await tx.subtask.updateMany({ where: { taskId, deletedAt: null }, data: { deletedAt: now } });
    await tx.comment.updateMany({ where: { taskId, deletedAt: null }, data: { deletedAt: now } });
    await tx.activityLog.create({
      data: {
        userId,
        taskId,
        action: "TASK_DELETED",
        meta: { organizationId, projectId, taskId },
      },
    });
    return task;
  });

  await invalidateOrgDashboard(organizationId);
  return result;
};

const createSubtask = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  payload: { title: string },
) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  const subtask = await prisma.subtask.create({
    data: { taskId, title: payload.title.trim() },
  });

  await invalidateOrgDashboard(organizationId);
  return subtask;
};

const listSubtasks = async (userId: string, organizationId: string, projectId: string, taskId: string) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);
  return prisma.subtask.findMany({
    where: { taskId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
};

const updateSubtask = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  subtaskId: string,
  payload: { title?: string; isDone?: boolean },
) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  const subtask = await prisma.subtask.findFirst({
    where: { id: subtaskId, taskId, deletedAt: null },
  });
  if (!subtask) throw new AppError(httpStatus.NOT_FOUND, "Subtask not found");

  const updated = await prisma.subtask.update({
    where: { id: subtaskId },
    data: {
      ...(payload.title !== undefined && { title: payload.title.trim() }),
      ...(payload.isDone !== undefined && { isDone: payload.isDone }),
    },
  });

  await invalidateOrgDashboard(organizationId);
  return updated;
};

const deleteSubtask = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  subtaskId: string,
) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  const subtask = await prisma.subtask.findFirst({
    where: { id: subtaskId, taskId, deletedAt: null },
  });
  if (!subtask) throw new AppError(httpStatus.NOT_FOUND, "Subtask not found");

  const updated = await prisma.subtask.update({
    where: { id: subtaskId },
    data: { deletedAt: new Date() },
  });

  await invalidateOrgDashboard(organizationId);
  return updated;
};

const createComment = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  payload: { content: string },
) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  const comment = await prisma.comment.create({
    data: { taskId, userId, content: payload.content.trim() },
    include: { user: { select: { id: true, name: true, profileImage: true } } },
  });

  await invalidateOrgDashboard(organizationId);
  return comment;
};

const listComments = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  query: { page?: number; limit?: number },
) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  const { page, limit, skip } = calculatePagination(query);
  const where = { taskId, deletedAt: null };

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: { user: { select: { id: true, name: true, profileImage: true } } },
      skip,
      take: limit,
      orderBy: { createdAt: "asc" },
    }),
    prisma.comment.count({ where }),
  ]);

  return { data: comments, meta: buildPaginationMeta(total, page, limit) };
};

const deleteComment = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  commentId: string,
) => {
  const membership = await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, taskId, deletedAt: null },
  });
  if (!comment) throw new AppError(httpStatus.NOT_FOUND, "Comment not found");
  if (comment.userId !== userId && membership.role !== OrgRole.ORG_OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, "Only the author or ORG_OWNER can delete this comment");
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  await invalidateOrgDashboard(organizationId);
  return updated;
};

const uploadAttachment = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  file: Express.Multer.File,
) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  const uploaded = await uploadBufferToCloudinary(file.buffer, `taskflow/${organizationId}/${taskId}`);

  const attachment = await prisma.attachment.create({
    data: {
      taskId,
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      fileName: file.originalname,
      uploadedBy: userId,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      taskId,
      action: "ATTACHMENT_UPLOADED",
      meta: { organizationId, projectId, taskId, attachmentId: attachment.id, fileName: file.originalname },
    },
  });

  await invalidateOrgDashboard(organizationId);
  return attachment;
};

const listAttachments = async (userId: string, organizationId: string, projectId: string, taskId: string) => {
  await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);
  return prisma.attachment.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
  });
};

const deleteAttachment = async (
  userId: string,
  organizationId: string,
  projectId: string,
  taskId: string,
  attachmentId: string,
) => {
  const membership = await ensureMembership(userId, organizationId);
  await ensureTask(organizationId, projectId, taskId);

  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, taskId },
  });
  if (!attachment) throw new AppError(httpStatus.NOT_FOUND, "Attachment not found");
  if (attachment.uploadedBy !== userId && membership.role !== OrgRole.ORG_OWNER) {
    throw new AppError(httpStatus.FORBIDDEN, "Only the uploader or ORG_OWNER can delete this attachment");
  }

  if (attachment.publicId) await deleteFromCloudinary(attachment.publicId);
  await prisma.attachment.delete({ where: { id: attachmentId } });

  await invalidateOrgDashboard(organizationId);
  return null;
};

export const TaskService = {
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
