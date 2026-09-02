import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.route";

const router = Router();

// ── Auth (Module 2) ─────────────────────────────────────
router.use("/auth", authRoutes);

// ── Future modules (3→10) — uncomment when implemented ──
// import { organizationRoutes } from "../modules/organization/organization.route";
// import { projectRoutes } from "../modules/project/project.route";
// import { sprintRoutes } from "../modules/sprint/sprint.route";
// import { taskRoutes } from "../modules/task/task.route";
// import { paymentRoutes } from "../modules/payment/payment.route";
// import { adminRoutes } from "../modules/admin/admin.route";
// router.use("/organizations", organizationRoutes);
// router.use("/projects", projectRoutes);
// router.use("/payments", paymentRoutes);

export default router;
