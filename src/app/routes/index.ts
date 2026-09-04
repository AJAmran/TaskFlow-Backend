import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.route";
import { organizationRoutes } from "../modules/organization/organization.route";
import { teamRoutes } from "../modules/team/team.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/organizations", organizationRoutes);
router.use("/organizations", teamRoutes);



export default router;
