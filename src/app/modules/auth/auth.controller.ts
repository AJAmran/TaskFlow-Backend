import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthService } from "./auth.service";


const parseExpiryToMs = (value: string, fallbackMs: number): number => {
	const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
	if (!match) return fallbackMs;
	const amount = Number(match[1]);
	const unit = match[2] as "s" | "m" | "h" | "d";
	const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
	return amount * multipliers[unit];
};

const isProduction = config.node_env === "production";

const cookieOptions = (maxAge: number) => ({
	httpOnly: true,
	secure: isProduction,
	sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
	maxAge,
});

const accessCookieMaxAge = () =>
	parseExpiryToMs(config.jwt_access_expires_in, 15 * 60 * 1000);
const refreshCookieMaxAge = () =>
	parseExpiryToMs(config.jwt_refresh_expires_in, 7 * 24 * 60 * 60 * 1000);

const setAuthCookies = (
	res: Response,
	accessToken: string,
	refreshToken: string,
) => {
	res.cookie("accessToken", accessToken, cookieOptions(accessCookieMaxAge()));
	res.cookie("refreshToken", refreshToken, cookieOptions(refreshCookieMaxAge()));
};

const clearCookieOptions = {
	httpOnly: true,
	secure: isProduction,
	sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
	path: "/",
};

const clearAuthCookies = (res: Response) => {
	res.clearCookie("accessToken", clearCookieOptions);
	res.clearCookie("refreshToken", clearCookieOptions);
};

const register = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.register(req.body);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: result.message,
		data: { user: result.user },
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
	if (!req.cookies.refreshToken) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
	}
	const result = await AuthService.refreshToken(req.cookies.refreshToken);
	const { accessToken, refreshToken: newRefreshToken } = result;

	setAuthCookies(res, accessToken, newRefreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully",
		data: {
			accessToken,
			refreshToken: newRefreshToken,
		},
	});
});

const logout = catchAsync(async (_req: Request, res: Response) => {
	clearAuthCookies(res);

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
