import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthService } from "./auth.service";


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

	res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
	res.cookie(
		"refreshToken",
		refreshToken,
		cookieOptions(7 * 24 * 60 * 60 * 1000),
	);
};

const register = catchAsync(async (req: Request, res: Response) => {
	const result = (await AuthService.register(req.body)) as unknown as {
		user: unknown;
		accessToken?: string;
		refreshToken?: string;
		message?: string;
	};


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
	if (!req.cookies.refreshToken) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
	}
	const result = await AuthService.refreshToken(req.cookies.refreshToken);
	const { accessToken, refreshToken: newRefreshToken } = result;

	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24,
	});
	res.cookie("refreshToken", newRefreshToken, {
		httpOnly: true,
		secure: false,
		sameSite: "none",
		maxAge: 1000 * 60 * 60 * 24 * 7,
	});

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
	res.clearCookie("accessToken", {
		httpOnly: true,
		secure: false,
		sameSite: "none",
	});
	res.clearCookie("refreshToken", {
		httpOnly: true,
		secure: false,
		sameSite: "none",
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
