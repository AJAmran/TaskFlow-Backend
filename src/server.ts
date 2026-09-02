import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";
import { connectRedis } from "./app/lib/redis";

const PORT = config.port;

const validateEnv = () => {
	const required = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;
	const missing = required.filter((k) => !process.env[k]);
	if (missing.length) {
		console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
		console.error("   → See .env.example for all required variables.");
		process.exit(1);
	}
};

const main = async () => {
	try {
		validateEnv();
		await prisma.$connect();
		console.log("✅ Connected to PostgreSQL via Prisma.");
		await connectRedis();
		app.listen(PORT, () => {
			console.log(`🚀 TaskFlow API running on port ${PORT} [${config.node_env}]`);
			console.log(`   → http://localhost:${PORT}`);
			console.log(`   → Health: http://localhost:${PORT}/health`);
		});
	} catch (error) {
		console.error("❌ Failed to start server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();

process.on("unhandledRejection", (err) => {
	console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
	console.error("Uncaught Exception:", err);
});
