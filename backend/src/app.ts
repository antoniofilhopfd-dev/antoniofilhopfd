import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    })
  );
  app.use(express.json());

  app.use(healthRouter);

  return app;
}
