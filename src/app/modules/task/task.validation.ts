import { z } from "zod";
import { TaskPriority, TaskStatus } from "../../../generated/prisma/enums";

const dateSchema = (message: string) =>
  z.string({ message }).datetime({ message: "Must be a valid ISO datetime" });

export const TaskValidation = {
  createTaskSchema: z.object({
    title: z
      .string({ message: "Task title is required" })
      .min(2, "Title must be at least 2 characters")
      .max(200, "Title cannot exceed 200 characters")
      .trim(),
    description: z.string().max(5000).trim().optional(),
    priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.MEDIUM),
    sprintId: z.string().uuid("sprintId must be a valid UUID").optional(),
    assigneeId: z.string().uuid("assigneeId must be a valid UUID").optional(),
    dueDate: dateSchema("dueDate must be a valid ISO datetime").optional(),
  }),

  updateTaskSchema: z.object({
    title: z.string().min(2).max(200).trim().optional(),
    description: z.string().max(5000).trim().nullable().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    sprintId: z.string().uuid("sprintId must be a valid UUID").nullable().optional(),
    dueDate: dateSchema("dueDate must be a valid ISO datetime").nullable().optional(),
  }),

  listTasksQuerySchema: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    assigneeId: z.string().uuid("assigneeId must be a valid UUID").optional(),
    sprintId: z.string().uuid("sprintId must be a valid UUID").optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "dueDate", "priority"]).optional().default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
    q: z.string().trim().min(1).max(100).optional(),
  }),

  myAssignedQuerySchema: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    status: z.nativeEnum(TaskStatus).optional(),
  }),

  statusTransitionSchema: z.object({
    status: z.nativeEnum(TaskStatus),
  }),

  assignTaskSchema: z.object({
    userId: z.string({ message: "userId is required" }).uuid("userId must be a valid UUID"),
  }),

  createSubtaskSchema: z.object({
    title: z
      .string({ message: "Subtask title is required" })
      .min(1, "Title is required")
      .max(200, "Title cannot exceed 200 characters")
      .trim(),
  }),

  updateSubtaskSchema: z.object({
    title: z.string().min(1).max(200).trim().optional(),
    isDone: z.boolean().optional(),
  }),

  createCommentSchema: z.object({
    content: z
      .string({ message: "Comment content is required" })
      .min(1, "Content is required")
      .max(2000, "Content cannot exceed 2000 characters")
      .trim(),
  }),

  paginationQuerySchema: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
  }),
};

export type ListTasksQuery = {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  sprintId?: string;
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "priority";
  sortOrder?: "asc" | "desc";
  q?: string;
};
