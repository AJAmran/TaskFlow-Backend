import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthService } from "./auth.service";

// Cookie options — secure in production, lax for dev
const cookieOptions = (maxAge: number) => ({
	httpOnly: true,
	secure: config.node_env === "production",
	sameSite:
		config.node_env === "production" ? ("none" as const) : ("lax" as const),
	maxAge,
});

const setAuthCookies = (
	res: Response,
	accessToken: string,
	refreshToken: string,
) => {
	// Access token: 15 min default, but we align with env (fallback 15m)
	// Using ms for maxAge — approximate from env string
	res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000)); // 15 min
	res.cookie(
		"refreshToken",
		refreshToken,
		cookieOptions(7 * 24 * 60 * 60 * 1000),
	); // 7 days
};

const register = catchAsync(async (req: Request, res: Response) => {
	const result = (await AuthService.register(req.body)) as unknown as {
		user: unknown;
		accessToken?: string;
		refreshToken?: string;
		message?: string;
	};

	// New flow: no tokens until email verified
	if (!("accessToken" in result) || !result.accessToken) {
		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message:
				(result as { message: string }).message ||
				"OTP sent to email. Please verify.",
			data: { user: (result as { user: unknown }).user },
		});
		return;
	}

	setAuthCookies(
		res,
		result.accessToken as string,
		result.refreshToken as string,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "User registered successfully",
		data: {
			user: result.user,
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
		},
	});
});

const login = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.login(req.body);

	setAuthCookies(res, result.accessToken, result.refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: {
			user: result.user,
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
		},
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	const token =
		(req.cookies?.refreshToken as string) ||
		(req.body?.refreshToken as string) ||
		(req.headers["x-refresh-token"] as string);

	if (!token) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
	}

	const result = await AuthService.refreshToken(token);

	setAuthCookies(res, result.accessToken, result.refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Access token refreshed successfully",
		data: {
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
		},
	});
});

const logout = catchAsync(async (_req: Request, res: Response) => {
	res.clearCookie("accessToken", {
		httpOnly: true,
		secure: config.node_env === "production",
		sameSite: config.node_env === "production" ? "none" : "lax",
	});
	res.clearCookie("refreshToken", {
		httpOnly: true,
		secure: config.node_env === "production",
		sameSite: config.node_env === "production" ? "none" : "lax",
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Logged out successfully",
		data: null,
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.googleLogin(req.body);

	setAuthCookies(res, result.accessToken, result.refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Google login successful",
		data: {
			user: result.user,
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
		},
	});
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");

	await AuthService.changePassword(user.userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Password changed successfully",
		data: null,
	});
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");

	const result = await AuthService.getMe(user.userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile fetched successfully",
		data: result,
	});
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.verifyEmail(req.body);

	setAuthCookies(res, result.accessToken, result.refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Email verified successfully",
		data: {
			user: result.user,
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
		},
	});
});

const resendOtp = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.resendOtp(req.body.email);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.forgotPassword(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.resetPassword(req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: null,
	});
});

export const AuthController = {
	register,
	login,
	refreshToken,
	logout,
	googleLogin,
	verifyEmail,
	resendOtp,
	forgotPassword,
	resetPassword,
	changePassword,
	getMe,
};
