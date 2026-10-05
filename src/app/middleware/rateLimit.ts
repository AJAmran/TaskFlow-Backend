import {
	MemoryStore,
	rateLimit,
	type Options,
	type Store,
} from "express-rate-limit";
import httpStatus from "http-status";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../lib/redis";

class FailoverStore implements Store {
	private keyPrefix: string;
	private redis: RedisStore | null = null;
	private memory: MemoryStore = new MemoryStore();
	private options: Options | null = null;

	constructor(prefix: string) {
		this.keyPrefix = prefix;
	}

	init(options: Options): void {
		this.options = options;
		this.memory.init(options);
	}

	private getRedis(): RedisStore | null {
		try {
			if (!redisClient.isOpen) return null;
			if (!this.redis) {
				const store = new RedisStore({
					sendCommand: (...args: string[]) => redisClient.sendCommand(args),
					prefix: this.keyPrefix,
				});
				if (this.options) store.init(this.options);
				this.redis = store;
			}
			return this.redis;
		} catch {
			return null;
		}
	}

	async increment(key: string) {
		const redis = this.getRedis();
		if (redis) {
			try {
				return await redis.increment(key);
			} catch {}
		}
		return this.memory.increment(key);
	}

	async decrement(key: string) {
		const redis = this.getRedis();
		if (redis) {
			try {
				await redis.decrement(key);
				return;
			} catch {}
		}
		await this.memory.decrement(key);
	}

	async resetKey(key: string) {
		const redis = this.getRedis();
		if (redis) {
			try {
				await redis.resetKey(key);
			} catch {}
		}
		await this.memory.resetKey(key);
	}
}

const tooManyHandler = (
	_req: unknown,
	res: { status: (c: number) => { json: (b: unknown) => void } },
	message: string,
) => {
	res.status(httpStatus.TOO_MANY_REQUESTS).json({
		success: false,
		statusCode: httpStatus.TOO_MANY_REQUESTS,
		message,
		errors: [{ path: "", message }],
	});
};

const WINDOW_15_MIN = 15 * 60 * 1000;
const WINDOW_1_HOUR = 60 * 60 * 1000;

const buildAuthLimiter = (
	name: string,
	max: number,
	windowMs: number,
	message: string,
) =>
	rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		store: new FailoverStore(`rl:${name}:`),
		handler: (_req, res) => tooManyHandler(_req, res, message),
	});

export const loginLimiter = buildAuthLimiter(
	"login",
	10,
	WINDOW_15_MIN,
	"Too many login attempts. Please try again in a few minutes.",
);

export const registerLimiter = buildAuthLimiter(
	"register",
	5,
	WINDOW_1_HOUR,
	"Too many accounts created from this network. Please try again later.",
);

export const otpVerifyLimiter = buildAuthLimiter(
	"otp-verify",
	15,
	WINDOW_15_MIN,
	"Too many verification attempts. Please request a new code.",
);

export const otpResendLimiter = buildAuthLimiter(
	"otp-resend",
	5,
	WINDOW_1_HOUR,
	"Too many codes requested. Please try again later.",
);

export const forgotPasswordLimiter = buildAuthLimiter(
	"forgot-password",
	5,
	WINDOW_1_HOUR,
	"Too many reset requests. Please try again later.",
);

export const refreshTokenLimiter = buildAuthLimiter(
	"refresh-token",
	30,
	WINDOW_15_MIN,
	"Too many session refreshes. Please sign in again.",
);

export const googleAuthLimiter = buildAuthLimiter(
	"google",
	20,
	WINDOW_15_MIN,
	"Too many sign-in attempts. Please try again later.",
);

export const authLimiter = buildAuthLimiter(
	"auth",
	150,
	WINDOW_15_MIN,
	"Too many auth requests. Please try again later.",
);

export const paymentLimiter = buildAuthLimiter(
	"payment",
	30,
	WINDOW_15_MIN,
	"Too many payment requests. Please try again later.",
);
