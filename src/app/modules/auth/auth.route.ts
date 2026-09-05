import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { authLimiter } from "../../middleware/rateLimit";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	authLimiter,
	validateRequest(AuthValidation.registerSchema),
	AuthController.register,
);

router.post(
	"/login",
	authLimiter,
	validateRequest(AuthValidation.loginSchema),
	AuthController.login,
);

router.post(
	"/google",
	authLimiter,
	validateRequest(AuthValidation.googleLoginSchema),
	AuthController.googleLogin,
);

router.post(
	"/social-login",
	authLimiter,
	validateRequest(AuthValidation.googleLoginSchema),
	AuthController.googleLogin,
);

router.post(
	"/verify-email",
	authLimiter,
	validateRequest(AuthValidation.verifyEmailSchema),
	AuthController.verifyEmail,
);

router.post(
	"/resend-otp",
	authLimiter,
	validateRequest(AuthValidation.resendOtpSchema),
	AuthController.resendOtp,
);

router.post(
	"/forgot-password",
	authLimiter,
	validateRequest(AuthValidation.forgotPasswordSchema),
	AuthController.forgotPassword,
);

router.post(
	"/reset-password",
	authLimiter,
	validateRequest(AuthValidation.resetPasswordSchema),
	AuthController.resetPassword,
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
