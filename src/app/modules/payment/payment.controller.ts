import type { Request, Response } from "express";
import httpStatus from "http-status";
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

const callback = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.handleCallback(
    req.query as { paymentID?: string; status?: string },
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: result.payment,
  });
});

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
  const result = await PaymentService.getById(user.userId, req.params.id as string);
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
  const result = await PaymentService.getSubscription(user.userId, req.params.organizationId as string);
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
