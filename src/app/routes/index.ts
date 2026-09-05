import { Router } from "express";
import { adminRoutes } from "../modules/admin/admin.route";
import { authRoutes } from "../modules/auth/auth.route";
import { dashboardRoutes } from "../modules/dashboard/dashboard.route";
import { organizationRoutes } from "../modules/organization/organization.route";
import { paymentRoutes, subscriptionRoutes } from "../modules/payment/payment.route";
import { projectRoutes } from "../modules/project/project.route";
import { sprintRoutes } from "../modules/sprint/sprint.route";
import { taskRoutes } from "../modules/task/task.route";
import { teamRoutes } from "../modules/team/team.route";
import { userRoutes } from "../modules/user/user.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/payments", paymentRoutes);
router.use("/organizations", organizationRoutes);
router.use("/organizations", subscriptionRoutes);
router.use("/organizations", teamRoutes);
router.use("/organizations", projectRoutes);
router.use("/organizations", sprintRoutes);
router.use("/organizations", taskRoutes);
router.use("/users", userRoutes);
router.use("/organizations", dashboardRoutes);



export default router;
