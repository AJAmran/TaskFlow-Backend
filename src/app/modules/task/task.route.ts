import { Router } from "express";
import { authenticate, requireOrgMembership } from "../../middleware/auth";
import { upload } from "../../middleware/upload";
import { validateRequest, validateRequestWith } from "../../middleware/validateRequest";
import { TaskController } from "./task.controller";
import { TaskValidation } from "./task.validation";

const router = Router({ mergeParams: true });

router.get(
  "/:organizationId/tasks/my-assigned",
  authenticate,
  requireOrgMembership,
  validateRequestWith({ query: TaskValidation.myAssignedQuerySchema }),
  TaskController.myAssigned,
);

router.post(
  "/:organizationId/projects/:projectId/tasks",
  authenticate,
  requireOrgMembership,
  validateRequest(TaskValidation.createTaskSchema),
  TaskController.createTask,
);

router.get(
  "/:organizationId/projects/:projectId/tasks",
  authenticate,
  requireOrgMembership,
  validateRequestWith({ query: TaskValidation.listTasksQuerySchema }),
  TaskController.listTasks,
);

router.get(
  "/:organizationId/projects/:projectId/tasks/:taskId",
  authenticate,
  requireOrgMembership,
  TaskController.getTaskById,
);

router.patch(
  "/:organizationId/projects/:projectId/tasks/:taskId",
  authenticate,
  requireOrgMembership,
  validateRequest(TaskValidation.updateTaskSchema),
  TaskController.updateTask,
);

router.delete(
  "/:organizationId/projects/:projectId/tasks/:taskId",
  authenticate,
  requireOrgMembership,
  TaskController.softDeleteTask,
);

router.patch(
  "/:organizationId/projects/:projectId/tasks/:taskId/status",
  authenticate,
  requireOrgMembership,
  validateRequest(TaskValidation.statusTransitionSchema),
  TaskController.changeStatus,
);

router.post(
  "/:organizationId/projects/:projectId/tasks/:taskId/assign",
  authenticate,
  requireOrgMembership,
  validateRequest(TaskValidation.assignTaskSchema),
  TaskController.assignTask,
);

router.post(
  "/:organizationId/projects/:projectId/tasks/:taskId/subtasks",
  authenticate,
  requireOrgMembership,
  validateRequest(TaskValidation.createSubtaskSchema),
  TaskController.createSubtask,
);

router.get(
  "/:organizationId/projects/:projectId/tasks/:taskId/subtasks",
  authenticate,
  requireOrgMembership,
  TaskController.listSubtasks,
);

router.patch(
  "/:organizationId/projects/:projectId/tasks/:taskId/subtasks/:subtaskId",
  authenticate,
  requireOrgMembership,
  validateRequest(TaskValidation.updateSubtaskSchema),
  TaskController.updateSubtask,
);

router.delete(
  "/:organizationId/projects/:projectId/tasks/:taskId/subtasks/:subtaskId",
  authenticate,
  requireOrgMembership,
  TaskController.deleteSubtask,
);

router.post(
  "/:organizationId/projects/:projectId/tasks/:taskId/comments",
  authenticate,
  requireOrgMembership,
  validateRequest(TaskValidation.createCommentSchema),
  TaskController.createComment,
);

router.get(
  "/:organizationId/projects/:projectId/tasks/:taskId/comments",
  authenticate,
  requireOrgMembership,
  validateRequestWith({ query: TaskValidation.paginationQuerySchema }),
  TaskController.listComments,
);

router.delete(
  "/:organizationId/projects/:projectId/tasks/:taskId/comments/:commentId",
  authenticate,
  requireOrgMembership,
  TaskController.deleteComment,
);

router.post(
  "/:organizationId/projects/:projectId/tasks/:taskId/attachments",
  authenticate,
  requireOrgMembership,
  upload.single("file"),
  TaskController.uploadAttachment,
);

router.get(
  "/:organizationId/projects/:projectId/tasks/:taskId/attachments",
  authenticate,
  requireOrgMembership,
  TaskController.listAttachments,
);

router.delete(
  "/:organizationId/projects/:projectId/tasks/:taskId/attachments/:attachmentId",
  authenticate,
  requireOrgMembership,
  TaskController.deleteAttachment,
);

export const taskRoutes = router;
