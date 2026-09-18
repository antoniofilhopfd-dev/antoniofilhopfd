import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { compareWeeks, getWeekSummary, listAvailableWeeks, shiftWeek } from "../metrics/service";
import { getWeekStart } from "../metrics/weeks";

export const metricsRouter = Router();

metricsRouter.use(requireAuth);

metricsRouter.get("/metrics/weeks", async (_req, res) => {
  const weeks = await listAvailableWeeks();
  res.json(weeks);
});

metricsRouter.get("/metrics/weeks/:weekStart", async (req, res) => {
  const parsed = new Date(`${req.params.weekStart}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return res.status(400).json({ error: "Data de início de semana inválida." });
  }

  const summary = await getWeekSummary(parsed);
  res.json(summary);
});

metricsRouter.get("/metrics/weeks/:weekStart/compare", async (req, res) => {
  const parsed = new Date(`${req.params.weekStart}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return res.status(400).json({ error: "Data de início de semana inválida." });
  }

  const currentStart = getWeekStart(parsed);
  const previousStart = shiftWeek(currentStart, -1);

  const comparison = await compareWeeks(currentStart, previousStart);
  res.json(comparison);
});
