import httpStatus from "http-status";
import { createClient } from "redis";
import config from "../config";
import { AppError } from "../utils/AppError";

export const redisClient = createClient({
	username: config.redis_user,
	password: config.redis_password,
	socket: {
		host: config.redis_host,
		port: Number(config.redis_port),
	},
});

export const requireRedis = (): void => {
	if (!redisClient.isOpen) {
		throw new AppError(
			httpStatus.SERVICE_UNAVAILABLE,
			"Service temporarily unavailable. Please try again in a moment.",
		);
	}
};
