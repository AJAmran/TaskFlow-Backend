import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import {
	authLimiter,
	forgotPasswordLimiter,
	googleAuthLimiter,
	loginLimiter,
	otpResendLimiter,
	otpVerifyLimiter,
	refreshTokenLimiter,
	registerLimiter,
} from "../../middleware/rateLimit";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	registerLimiter,
	validateRequest(AuthValidation.registerSchema),
	AuthController.register,
);

router.post(
	"/login",
	loginLimiter,
	validateRequest(AuthValidation.loginSchema),
	AuthController.login,
);

router.post(
	"/google",
	googleAuthLimiter,
	validateRequest(AuthValidation.googleLoginSchema),
	AuthController.googleLogin,
);

router.post(
	"/social-login",
	googleAuthLimiter,
	validateRequest(AuthValidation.googleLoginSchema),
	AuthController.googleLogin,
);

router.post(
	"/verify-email",
	otpVerifyLimiter,
	validateRequest(AuthValidation.verifyEmailSchema),
	AuthController.verifyEmail,
);

router.post(
	"/resend-otp",
	otpResendLimiter,
	validateRequest(AuthValidation.resendOtpSchema),
	AuthController.resendOtp,
);

router.post(
	"/forgot-password",
	forgotPasswordLimiter,
	validateRequest(AuthValidation.forgotPasswordSchema),
	AuthController.forgotPassword,
);

router.post(
	"/reset-password",
	otpVerifyLimiter,
	validateRequest(AuthValidation.resetPasswordSchema),
	AuthController.resetPassword,
);

router.post("/refresh-token", refreshTokenLimiter, AuthController.refreshToken);

router.post("/logout", authLimiter, AuthController.logout);

router.get("/me", authenticate, AuthController.getMe);

router.post(
	"/change-password",
	authenticate,
	validateRequest(AuthValidation.changePasswordSchema),
	AuthController.changePassword,
);

export const authRoutes = router;
