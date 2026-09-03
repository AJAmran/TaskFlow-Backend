import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../utils/AppError";

type TErrorSource = { path: string; message: string };

export const globalErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const isDevelopment = config.node_env === "development";

  if (isDevelopment) {
    console.error("❌ GlobalErrorHandler:", err);
  }

  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";
  let errors: TErrorSource[] = [];


  if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation error";
    errors = err.issues.map((issue) => ({
      path: issue.path.join(".") || "body",
      message: issue.message,
    }));
  }


  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = [{ path: "", message: err.message }];
  }


  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Invalid data provided";
    errors = [{ path: "", message }];
  }
  

  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        statusCode = httpStatus.CONFLICT;
        message = "A record with this value already exists";
        break;
      case "P2003":
        statusCode = httpStatus.BAD_REQUEST;
        message = "Foreign key constraint failed";
        break;
      case "P2025":
        statusCode = httpStatus.NOT_FOUND;
        message = "Requested record was not found";
        break;
      default:
        statusCode = httpStatus.BAD_REQUEST;
        message = "Database request failed";
    }
    errors = [{ path: "", message }];
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = "Database connection error";
    errors = [{ path: "", message }];
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = "An unexpected database error occurred";
    errors = [{ path: "", message }];
  } else if (err instanceof Error) {
    message = err.message;
    errors = [{ path: "", message }];
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors,
    ...(isDevelopment && {
      stack: err instanceof Error ? err.stack : undefined,
    }),
  });
};
