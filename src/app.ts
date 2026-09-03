import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import helmet from "helmet";
import httpStatus from "http-status";
import path from "node:path";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import router from "./app/routes";

const app: Application = express();


app.use(helmet());

app.use(
	cors({
		origin: (origin, cb) => {
			const allowed = [
				process.env.FRONTEND_URL,
				"http://localhost:3000",
				"http://localhost:3001",
				"http://127.0.0.1:3000",
			].filter(Boolean) as string[];
			if (!origin || allowed.includes(origin)) cb(null, true);
			else cb(null, true);
		},
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

app.use("/google-test", express.static(path.join(process.cwd(), "frontend_for_google_login_test")));
app.get("/google-test.html", (_req, res) => res.sendFile(path.join(process.cwd(), "frontend_for_google_login_test", "index.html")));

app.use(notFound);
app.use(globalErrorHandler);

export default app;
