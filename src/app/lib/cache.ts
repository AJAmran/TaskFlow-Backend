import { redisClient } from "./redis";

export const DASHBOARD_TTL_SECONDS = 60;

export const dashboardKey = (organizationId: string) => `dashboard:org:${organizationId}`;

export const getCachedJSON = async <T>(key: string): Promise<T | null> => {
  try {
    if (!redisClient.isOpen) return null;
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const setCachedJSON = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  try {
    if (!redisClient.isOpen) return;
    await redisClient.set(key, JSON.stringify(value), {
      expiration: { type: "EX", value: ttlSeconds },
    });
  } catch {}
};

export const invalidateOrgDashboard = async (organizationId: string): Promise<void> => {
  try {
    if (!redisClient.isOpen) return;
    await redisClient.del(dashboardKey(organizationId));
  } catch {}
};
