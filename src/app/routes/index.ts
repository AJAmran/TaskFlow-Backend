import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.route";
import { dashboardRoutes } from "../modules/dashboard/dashboard.route";
import { organizationRoutes } from "../modules/organization/organization.route";
import { projectRoutes } from "../modules/project/project.route";
import { sprintRoutes } from "../modules/sprint/sprint.route";
import { teamRoutes } from "../modules/team/team.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/organizations", organizationRoutes);
router.use("/organizations", teamRoutes);
router.use("/organizations", projectRoutes);
router.use("/organizations", sprintRoutes);
router.use("/organizations", dashboardRoutes);



export default router;
