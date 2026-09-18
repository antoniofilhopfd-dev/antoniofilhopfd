import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/middleware";
import { MetaApiError } from "../meta/client";
import { checkConnection, getConnectionStatus, syncHierarchy, syncInsights } from "../meta/syncService";

export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

integrationsRouter.get("/integrations/meta/status", async (_req, res) => {
  const status = await getConnectionStatus();
  res.json(status);
});

integrationsRouter.post(
  "/integrations/meta/check-connection",
  requireRole(UserRole.ADMIN),
  async (_req, res) => {
    const result = await checkConnection();
    res.json(result);
  }
);

integrationsRouter.post("/integrations/meta/sync", requireRole(UserRole.ADMIN), async (req, res) => {
  const daysBack = Number(req.body?.daysBack ?? 30);

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
