import { MemoryStore, rateLimit, type Options, type Store } from "express-rate-limit";
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

export const authLimiter = rateLimit({
  windowMs: WINDOW_15_MIN,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new FailoverStore("rl:auth:"),
  handler: (_req, res) => tooManyHandler(_req, res, "Too many auth requests. Please try again later."),
});

export const paymentLimiter = rateLimit({
  windowMs: WINDOW_15_MIN,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new FailoverStore("rl:payment:"),
  handler: (_req, res) => tooManyHandler(_req, res, "Too many payment requests. Please try again later."),
});
