import { createClient } from "redis";
import config from "../config";

type RedisClientType = ReturnType<typeof createClient>;

/**
 * Redis client — used for:
 *  - bKash `id_token` caching (TTL ~ 50 min)
 *  - Dashboard stats cache (60s TTL)
 *  - Rate-limit store (if switched to Redis store later)
 *
 * Connection is lazy: call `connectRedis()` once at boot.
 * If REDIS_HOST is missing, the client is not created (graceful fallback).
 */
let redisClient: RedisClientType | null = null;
let isConnected = false;

const getRedisUrl = (): string | null => {
	if (!config.redis_host) return null;
	const user = config.redis_user || "default";
	const pass = config.redis_password || "";
	const host = config.redis_host;
	const port = config.redis_port;
	const protocol = host.includes("upstash") || host.includes("redis.io") ? "rediss" : "redis";
	if (pass) return `${protocol}://${user}:${pass}@${host}:${port}`;
	return `${protocol}://${host}:${port}`;
};

export const getRedisClient = (): RedisClientType | null => redisClient;

export const connectRedis = async (): Promise<void> => {
	if (!config.redis_host) {
		console.warn("⚠️  Redis not configured — caching & Redis rate-limit disabled.");
		return;
	}
	if (redisClient && isConnected) return;

	// Use socket config with TLS for Upstash / managed Redis
	const isManaged = config.redis_host.includes("upstash") || config.redis_host.includes("redis.io");
	redisClient = createClient({
		username: config.redis_user || "default",
		password: config.redis_password,
		socket: isManaged
			? {
					host: config.redis_host,
					port: Number(config.redis_port),
					tls: true,
					reconnectStrategy: () => false as unknown as number,
					connectTimeout: 3000,
				}
			: {
					host: config.redis_host,
					port: Number(config.redis_port),
					reconnectStrategy: () => false as unknown as number,
					connectTimeout: 3000,
				},
	});

	redisClient.on("error", (err) => {
		// single log, don't spam
		if (!isConnected) console.warn("⚠️  Redis error (non-blocking):", (err as Error).message);
	});
	redisClient.on("connect", () => console.log("🔌 Redis connecting..."));
	redisClient.on("ready", () => console.log("✅ Redis connected."));

	try {
		await Promise.race([
			redisClient.connect(),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Redis connect timeout (3s)")), 3500)),
		]);
		isConnected = true;
		console.log("✅ Redis ready.");
	} catch (error) {
		console.warn("⚠️  Redis connection failed (continuing without cache):", (error as Error).message);
		try {
			await redisClient.quit().catch(() => {});
		} catch {}
		redisClient = null;
		isConnected = false;
	}
};

export const disconnectRedis = async (): Promise<void> => {
	if (redisClient && isConnected) {
		await redisClient.quit();
		isConnected = false;
		redisClient = null;
	}
};

export const redisGet = async (key: string): Promise<string | null> => {
	if (!redisClient || !isConnected) return null;
	return redisClient.get(key);
};

export const redisSet = async (key: string, value: string, ttlSeconds?: number): Promise<void> => {
	if (!redisClient || !isConnected) return;
	if (ttlSeconds) await redisClient.set(key, value, { EX: ttlSeconds });
	else await redisClient.set(key, value);
};

export const redisDel = async (key: string): Promise<void> => {
	if (!redisClient || !isConnected) return;
	await redisClient.del(key);
};

export const redisExists = async (key: string): Promise<boolean> => {
	if (!redisClient || !isConnected) return false;
	return (await redisClient.exists(key)) === 1;
};

// Legacy export for backwards compatibility
export { redisClient };
