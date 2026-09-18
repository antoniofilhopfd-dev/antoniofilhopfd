import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/middleware";
import { MetaApiError } from "../meta/client";
import { checkConnection, getConnectionStatus, syncHierarchy, syncInsights } from "../meta/syncService";
import { isSchedulerRunning } from "../meta/scheduler";

export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

integrationsRouter.get("/integrations/meta/status", async (_req, res) => {
  const status = await getConnectionStatus();
  res.json({
    ...status,
    schedulerRunning: isSchedulerRunning(),
    schedulerIntervalMinutes: process.env.META_SYNC_INTERVAL_MINUTES
      ? Number(process.env.META_SYNC_INTERVAL_MINUTES)
      : null,
  });
});

integrationsRouter.post(
  "/integrations/meta/check-connection",
  requireRole(UserRole.ADMIN),
  async (_req, res) => {
    const result = await checkConnection();
    res.json(result);
  }
);

// daysBack: distingue "atualizar recentes" (poucos dias) de "importação
// histórica" (janela maior), ambas via o mesmo caminho transacional
// (Seção 3/11 — importação histórica e atualização recente).
integrationsRouter.post("/integrations/meta/sync", requireRole(UserRole.ADMIN), async (req, res) => {
  const rawDaysBack = Number(req.body?.daysBack ?? 7);
  if (!Number.isFinite(rawDaysBack) || rawDaysBack < 1 || rawDaysBack > 365) {
    return res.status(400).json({ error: "daysBack deve estar entre 1 e 365." });
  }
  const daysBack = Math.floor(rawDaysBack);

  try {
    const hierarchyResult = await syncHierarchy(req.currentUser!.id);
    const insightsResult = await syncInsights(req.currentUser!.id, daysBack);
    res.json({ hierarchy: hierarchyResult, insights: insightsResult });
  } catch (error) {
    if (error instanceof MetaApiError) {
      const statusCode = error.kind === "not_configured" ? 409 : 502;
      return res.status(statusCode).json({ error: error.message, kind: error.kind });
    }
    const message = error instanceof Error ? error.message : "Erro desconhecido na sincronização.";
    res.status(409).json({ error: message });
  }
});
