import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { metricsRouter } from "./routes/metrics";
import { hierarchyRouter } from "./routes/hierarchy";
import { integrationsRouter } from "./routes/integrations";
import { observationsRouter } from "./routes/observations";
import { reportsRouter } from "./routes/reports";
import { draftsRouter } from "./routes/drafts";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      // API só serve JSON e arquivos de imagem próprios, nunca HTML de
      // terceiros — CSP de página não se aplica; desligar evita bloquear
      // por engano algo que o frontend (outra origem) precise carregar.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
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
  app.use(draftsRouter);

  // Handler de erro final: nunca deixa uma exceção não tratada (ex.: erro
  // do Prisma, falha de I/O) vazar stack trace/detalhes internos para o
  // cliente — loga no servidor e responde só uma mensagem genérica.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Erro interno." });
  });

  return app;
}
