import app from "./app";
import config from "./app/config";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";

const PORT = config.port;

const gracefulShutdown = async (signal: string) => {
	console.log(`\n${signal} received. Shutting down gracefully...`);
	try {
		if (redisClient.isOpen) {
			await redisClient.quit();
			console.log("Redis disconnected.");
		}
	} catch {}
	try {
		await prisma.$disconnect();
		console.log("Database disconnected.");
	} catch {}
	process.exit(0);
};

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");


		try {
			if (!redisClient.isOpen) await redisClient.connect();
			console.log("Redis Connected Successfully.");
		} catch (redisError) {
			console.warn("⚠️  Redis connection failed — continuing without cache:", (redisError as Error).message);
		}

		try {
			await transporter.verify();
			console.log("Nodemailer Connected Successfully.");
		} catch (mailError) {
			console.warn("⚠️  Nodemailer verify failed — continuing:", (mailError as Error).message);
		}

		const server = app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});


		process.on("SIGINT", () => gracefulShutdown("SIGINT"));
		process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
		process.on("unhandledRejection", (reason) => {
			console.error("Unhandled Rejection:", reason);
		});
		process.on("uncaughtException", async (error) => {
			console.error("Uncaught Exception:", error);
			await gracefulShutdown("uncaughtException");
		});


		void server;
	} catch (error) {
		console.error("Error starting the server:", error);
		try {
			if (redisClient.isOpen) await redisClient.quit();
		} catch {}
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();
