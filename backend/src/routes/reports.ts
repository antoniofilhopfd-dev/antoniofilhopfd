import { Router } from "express";
import { UserRole } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/middleware";
import { getReportData } from "../reports/reportData";
import { generateReportPdf, generateExecutivePdf } from "../reports/pdf";
import { generateReportCsv } from "../reports/csv";
import { getExecutiveReport } from "../reports/executiveData";
import { generateReportXlsx } from "../reports/xlsx";
import { getConclusion, upsertConclusion } from "../reports/conclusionService";

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

function executiveFilename(weekStart: string, weekEnd: string, ext: string): string {
  return `Evolucao_Trafego_Relatorio_${weekStart}_a_${weekEnd}.${ext}`;
}

// Relatório Executivo — dados em JSON para a tela (Home do perfil
// Relatório e Relatórios → Relatório Executivo). Acessível a qualquer
// usuário autenticado: é o mesmo dado usado pelo Administrador/Gestor
// e pelo perfil Relatório (Visualizador), só a experiência de tela muda.
reportsRouter.get("/reports/weeks/:weekStart/executive", async (req, res) => {
  const weekStart = parseWeekStart(req.params.weekStart);
  if (!weekStart) {
    return res.status(400).json({ error: "Data de início de semana inválida." });
  }

  const [week, executive] = await Promise.all([
    getReportData(weekStart).then((d) => d.week),
    getExecutiveReport(weekStart),
  ]);

  res.json({ week, ...executive });
});

reportsRouter.get("/reports/weeks/:weekStart/executive/pdf", async (req, res) => {
  const weekStart = parseWeekStart(req.params.weekStart);
  if (!weekStart) {
    return res.status(400).json({ error: "Data de início de semana inválida." });
  }

  const [data, executive] = await Promise.all([getReportData(weekStart), getExecutiveReport(weekStart)]);
  const doc = generateExecutivePdf(data, executive);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${executiveFilename(data.week.weekStart, data.week.weekEnd, "pdf")}"`
  );
  doc.pipe(res);
});

reportsRouter.get("/reports/weeks/:weekStart/executive/xlsx", async (req, res) => {
  const weekStart = parseWeekStart(req.params.weekStart);
  if (!weekStart) {
    return res.status(400).json({ error: "Data de início de semana inválida." });
  }

  const [data, executive] = await Promise.all([getReportData(weekStart), getExecutiveReport(weekStart)]);
  const buffer = await generateReportXlsx(data.week, executive);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${executiveFilename(data.week.weekStart, data.week.weekEnd, "xlsx")}"`
  );
  res.send(Buffer.from(buffer));
});

reportsRouter.get("/reports/weeks/:weekStart/conclusion", async (req, res) => {
  const weekStart = parseWeekStart(req.params.weekStart);
  if (!weekStart) {
    return res.status(400).json({ error: "Data de início de semana inválida." });
  }

  const conclusion = await getConclusion(weekStart);
  res.json(
    conclusion
      ? {
          text: conclusion.text,
          author: conclusion.author,
          updatedAt: conclusion.updatedAt,
        }
      : null
  );
});

reportsRouter.put(
  "/reports/weeks/:weekStart/conclusion",
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    const weekStart = parseWeekStart(req.params.weekStart);
    if (!weekStart) {
      return res.status(400).json({ error: "Data de início de semana inválida." });
    }

    const { text } = req.body ?? {};
    if (typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "Texto da conclusão é obrigatório." });
    }

    const conclusion = await upsertConclusion(weekStart, text.trim(), req.currentUser!.id);
    res.json({ text: conclusion.text, author: conclusion.author, updatedAt: conclusion.updatedAt });
  }
);
