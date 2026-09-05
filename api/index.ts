import type { Request, Response } from "express";
import app from "../src/app";
import { prisma } from "../src/app/lib/prisma";
import { redisClient } from "../src/app/lib/redis";

let ready: Promise<void> | null = null;

const init = (): Promise<void> => {
  if (!ready) {
    ready = (async () => {
      await prisma.$connect();
      try {
        if (!redisClient.isOpen) await redisClient.connect();
      } catch {}
    })();
  }
  return ready;
};

const handler = async (req: Request, res: Response): Promise<void> => {
  await init();
  app(req, res);
};

export default handler;
