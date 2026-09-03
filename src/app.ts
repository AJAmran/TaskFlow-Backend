import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import httpStatus from "http-status";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import router from "./app/routes";

const app: Application = express();


app.use(helmet());

app.use(
	cors({
		origin: process.env.FRONTEND_URL || "*",
		credentials: true,
	}),
);


app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.get("/", (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		statusCode: httpStatus.OK,
		message: "TaskFlow API is running 🚀",
		data: {
			name: "TaskFlow — Project Management SaaS",
			version: "1.0.0",
			environment: process.env.NODE_ENV || "development",
		},
	});
});

app.get("/health", (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		statusCode: httpStatus.OK,
		message: "OK",
		data: { uptime: process.uptime() },
	});
});

app.use("/api/v1", router);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
