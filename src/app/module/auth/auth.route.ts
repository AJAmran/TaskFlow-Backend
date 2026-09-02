import { Router } from "express";
import rateLimit from "express-rate-limit";
import httpStatus from "http-status";
import { authenticate } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

// Rate limit auth routes — 20 req / 15 min
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	handler: (_req, res) => {
		res.status(httpStatus.TOO_MANY_REQUESTS).json({
			success: false,
			statusCode: httpStatus.TOO_MANY_REQUESTS,
			message: "Too many auth requests. Please try again later.",
			errors: [{ path: "", message: "Auth rate limit exceeded" }],
		});
	},
});

router.post("/register", authLimiter, validateRequest(AuthValidation.registerSchema), AuthController.register);

router.post("/login", authLimiter, validateRequest(AuthValidation.loginSchema), AuthController.login);

router.post("/google", authLimiter, validateRequest(AuthValidation.googleLoginSchema), AuthController.googleLogin);

// Social login alias per guide: /social-login
router.post(
	"/social-login",
	authLimiter,
	validateRequest(AuthValidation.googleLoginSchema),
	AuthController.googleLogin,
);

router.post("/refresh-token", AuthController.refreshToken);

router.post("/logout", AuthController.logout);

router.get("/me", authenticate, AuthController.getMe);

router.post(
	"/change-password",
	authenticate,
	validateRequest(AuthValidation.changePasswordSchema),
	AuthController.changePassword,
);

export const authRoutes = router;
