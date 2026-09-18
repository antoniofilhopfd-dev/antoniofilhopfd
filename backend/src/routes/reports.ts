import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { getReportData } from "../reports/reportData";
import { generateReportPdf } from "../reports/pdf";
import { generateReportCsv } from "../reports/csv";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

function parseWeekStart(param: string): Date | null {
  const parsed = new Date(`${param}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

reportsRouter.get("/reports/weeks/:weekStart/pdf", async (req, res) => {
  const weekStart = parseWeekStart(req.params.weekStart);
  if (!weekStart) {
    return res.status(400).json({ error: "Data de início de semana inválida." });
  }

  const data = await getReportData(weekStart);
  const doc = generateReportPdf(data);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="relatorio-trafego-${data.week.weekStart}.pdf"`
  );
  doc.pipe(res);
});

reportsRouter.get("/reports/weeks/:weekStart/csv", async (req, res) => {
  const weekStart = parseWeekStart(req.params.weekStart);
  if (!weekStart) {
    return res.status(400).json({ error: "Data de início de semana inválida." });
  }

  const data = await getReportData(weekStart);
  const csv = generateReportCsv(data);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="relatorio-trafego-${data.week.weekStart}.csv"`
  );
  res.send(csv);
});
