import { Router } from "express";
import { prisma } from "../prisma";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      api: "up",
      database: "up",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      api: "up",
      database: "down",
      timestamp: new Date().toISOString(),
    });
  }
});
