import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { metricsRouter } from "./routes/metrics";
import { hierarchyRouter } from "./routes/hierarchy";
import { integrationsRouter } from "./routes/integrations";
import { observationsRouter } from "./routes/observations";
import { reportsRouter } from "./routes/reports";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use(healthRouter);
  app.use(authRouter);
  app.use(usersRouter);
  app.use(metricsRouter);
  app.use(hierarchyRouter);
  app.use(integrationsRouter);
  app.use(observationsRouter);
  app.use(reportsRouter);

  return app;
}
