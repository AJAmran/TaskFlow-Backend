import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";

const initiate = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
	const result = await PaymentService.initiate(user.userId, req.body);
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Payment session created. Complete payment at bkashURL.",
		data: result,
	});
});

const callback = async (req: Request, res: Response) => {
	const query = req.query as { paymentID?: string; status?: string };
	const frontendUrl = config.frontend_url || "http://localhost:3000";

	try {
		const result = await PaymentService.handleCallback(query);
		const payment = result.payment;
		const isSuccess = payment.status === "SUCCESS";

		if (isSuccess) {
			return res.redirect(
				`${frontendUrl}/payment/success?id=${payment.id}`,
			);
		}
		// Redirect all non-success outcomes (cancelled, failed) to cancel page
		return res.redirect(
			`${frontendUrl}/payment/cancel?paymentId=${payment.id}&status=${payment.status.toLowerCase()}`,
		);
	} catch {
		return res.redirect(`${frontendUrl}/payment/cancel`);
	}
};

const execute = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
	const result = await PaymentService.execute(user.userId, req.body.paymentID);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.message,
		data: result.payment,
	});
});

const getById = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
	const result = await PaymentService.getById(
		user.userId,
		req.params.id as string,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment fetched successfully",
		data: result,
	});
});

const getSubscription = catchAsync(async (req: Request, res: Response) => {
	const user = req.user;
	if (!user) throw new AppError(httpStatus.UNAUTHORIZED, "Not authenticated");
	const result = await PaymentService.getSubscription(
		user.userId,
		req.params.organizationId as string,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Subscription fetched successfully",
		data: result,
	});
});

export const PaymentController = {
	initiate,
	callback,
	execute,
	getById,
	getSubscription,
};
