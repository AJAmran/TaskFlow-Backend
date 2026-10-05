import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../utils/AppError";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const csrfGuard = (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	if (SAFE_METHODS.has(req.method)) {
		return next();
	}

	const origin = req.headers.origin;
	if (!origin) {
		return next();
	}

	const allowedOrigins = [
		process.env.FRONTEND_URL,
		"http://localhost:3000",
		"http://localhost:3001",
		"http://127.0.0.1:3000",
	].filter(Boolean) as string[];

	if (!allowedOrigins.includes(origin)) {
		return next(
			new AppError(httpStatus.FORBIDDEN, "Cross-origin request rejected."),
		);
	}

	return next();
};
