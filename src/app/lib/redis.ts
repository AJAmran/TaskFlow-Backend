import httpStatus from "http-status";
import { createClient } from "redis";
import config from "../config";
import { AppError } from "../utils/AppError";

export const redisClient = config.redis_url
	? createClient({ url: config.redis_url })
	: createClient({
			username: config.redis_user || undefined,
			password: config.redis_password || undefined,
			socket: {
				host: config.redis_host || "127.0.0.1",
				port: Number(config.redis_port) || 6379,
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
