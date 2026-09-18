import { Router } from "express";
import { EntityStatus, Segment, UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/middleware";
import {
  classifyCampaign,
  getAdSetDetail,
  getCampaignDetail,
  listAds,
  listCampaigns,
} from "../hierarchy/service";

export const hierarchyRouter = Router();

hierarchyRouter.use(requireAuth);

function parsePage(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

hierarchyRouter.get("/campaigns", async (req, res) => {
  const { search, status, segment, weekStart, page, pageSize } = req.query;

  if (status && !Object.values(EntityStatus).includes(status as EntityStatus)) {
    return res.status(400).json({ error: "Status inválido." });
  }
  if (segment && !Object.values(Segment).includes(segment as Segment)) {
    return res.status(400).json({ error: "Segmento inválido." });
  }

  const result = await listCampaigns({
    search: typeof search === "string" ? search : undefined,
    status: status as EntityStatus | undefined,
    segment: segment as Segment | undefined,
    weekStart: typeof weekStart === "string" ? weekStart : undefined,
    page: parsePage(page),
    pageSize: parsePage(pageSize),
  });

  res.json(result);
});

hierarchyRouter.get("/campaigns/:id", async (req, res) => {
  const { weekStart } = req.query;
  const detail = await getCampaignDetail(req.params.id, typeof weekStart === "string" ? weekStart : undefined);

  if (!detail) {
    return res.status(404).json({ error: "Campanha não encontrada." });
  }

  res.json(detail);
});

hierarchyRouter.patch(
  "/campaigns/:id/classification",
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    const { segment } = req.body ?? {};

    if (!Object.values(Segment).includes(segment)) {
      return res.status(400).json({ error: "Segmento inválido." });
    }

    try {
      const updated = await classifyCampaign(req.params.id, segment);
      res.json({ id: updated.id, segment: updated.segment, segmentSource: updated.segmentSource });
    } catch {
      res.status(404).json({ error: "Campanha não encontrada." });
    }
  }
);

hierarchyRouter.get("/adsets/:id", async (req, res) => {
  const { weekStart } = req.query;
  const detail = await getAdSetDetail(req.params.id, typeof weekStart === "string" ? weekStart : undefined);

  if (!detail) {
    return res.status(404).json({ error: "Conjunto não encontrado." });
  }

  res.json(detail);
});

hierarchyRouter.get("/ads", async (req, res) => {
  const { search, status, campaignId, weekStart, page, pageSize } = req.query;

  if (status && !Object.values(EntityStatus).includes(status as EntityStatus)) {
    return res.status(400).json({ error: "Status inválido." });
  }

  const result = await listAds({
    search: typeof search === "string" ? search : undefined,
    status: status as EntityStatus | undefined,
    campaignId: typeof campaignId === "string" ? campaignId : undefined,
    weekStart: typeof weekStart === "string" ? weekStart : undefined,
    page: parsePage(page),
    pageSize: parsePage(pageSize),
  });

  res.json(result);
});
