import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	validateRequest(AuthValidation.registerSchema),
	AuthController.register,
);

router.post(
	"/login",
	validateRequest(AuthValidation.loginSchema),
	AuthController.login,
);

router.post(
	"/google",
	validateRequest(AuthValidation.googleLoginSchema),
	AuthController.googleLogin,
);

router.post(
	"/social-login",
	validateRequest(AuthValidation.googleLoginSchema),
	AuthController.googleLogin,
);

router.post(
	"/verify-email",
	validateRequest(AuthValidation.verifyEmailSchema),
	AuthController.verifyEmail,
);

router.post(
	"/resend-otp",
	validateRequest(AuthValidation.resendOtpSchema),
	AuthController.resendOtp,
);

router.post(
	"/forgot-password",
	validateRequest(AuthValidation.forgotPasswordSchema),
	AuthController.forgotPassword,
);

router.post(
	"/reset-password",
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
