import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generateReportXlsx } from "./xlsx";
import type { WeekSummary } from "../metrics/service";
import type { ExecutiveReport } from "./executiveData";

function baseWeek(): WeekSummary {
  return {
    weekStart: "2026-01-04",
    weekEnd: "2026-01-10",
    daysAvailable: 7,
    isPartial: false,
    isDemo: true,
    daily: [],
    totals: {
      spend: 1000,
      resultsConversations: 50,
      impressions: 10000,
      clicksTotal: 300,
      clicksLink: 200,
      costPerResult: 20,
      ctr: 2,
      cpc: 5,
      cpm: 100,
    },
    reachNote: "",
  };
}

function baseExecutive(overrides: Partial<ExecutiveReport> = {}): ExecutiveReport {
  return {
    comparison: {
      current: baseWeek(),
      previous: baseWeek(),
      comparableDays: 7,
      comparisonNote: null,
      currentComparable: baseWeek().totals,
      previousComparable: baseWeek().totals,
    },
    campaigns: [
      {
        id: "c1",
        name: "Campanha Teste",
        status: "ACTIVE",
        segment: "EDUCACAO_INFANTIL",
        spend: 500,
        cpcLink: 2.5,
        clicksLink: 200,
        resultsConversations: 25,
        costPerResult: 20,
      },
    ],
    distribution: [{ campaignName: "Campanha Teste", spend: 500, percent: 100 }],
    segments: [
      {
        segment: "EDUCACAO_INFANTIL",
        spend: 500,
        resultsConversations: 25,
        clicksLink: 200,
        cpcLink: 2.5,
        costPerResult: 20,
      },
    ],
    reachAvailable: false,
    observations: [],
    conclusion: null,
    highlights: {
      topSpend: { campaignName: "Campanha Teste", spend: 500 },
      topConversations: { campaignName: "Campanha Teste", resultsConversations: 25 },
      lowestCostPerResult: { campaignName: "Campanha Teste", costPerResult: 20 },
    },
    ...overrides,
  };
}

describe("generateReportXlsx", () => {
  it("gera um arquivo com as abas Resumo e Campanhas, sem abas técnicas extras", async () => {
    const buffer = await generateReportXlsx(baseWeek(), baseExecutive());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheetNames = workbook.worksheets.map((s) => s.name);
    expect(sheetNames).toEqual(["Resumo", "Campanhas"]);
  });

  it("preenche a aba Resumo com investimento, CPC de link e custo por conversa", async () => {
    const buffer = await generateReportXlsx(baseWeek(), baseExecutive());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const resumo = workbook.getWorksheet("Resumo")!;
    const rows = resumo.getSheetValues() as unknown[][];
    const flat = rows.flat().filter(Boolean).map(String);

    expect(flat.some((v) => v.includes("Investimento Total"))).toBe(true);
    expect(flat.some((v) => v.includes("CPC de Link"))).toBe(true);
    expect(flat.some((v) => v.includes("Custo por Conversa"))).toBe(true);
  });

  it("preenche a aba Campanhas com números como números (não texto) e formato monetário", async () => {
    const buffer = await generateReportXlsx(baseWeek(), baseExecutive());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const campanhas = workbook.getWorksheet("Campanhas")!;
    const dataRow = campanhas.getRow(2);

    expect(typeof dataRow.getCell("D").value).toBe("number"); // Investimento
    expect(dataRow.getCell("D").numFmt).toContain("R$");
    expect(typeof dataRow.getCell("H").value).toBe("number"); // Conversas Iniciadas
  });

  it("não gera valores quebrados (NaN/Infinity) quando não há cliques no link", async () => {
    const executive = baseExecutive({
      campaigns: [
        {
          id: "c2",
          name: "Sem cliques",
          status: "ACTIVE",
          segment: null,
          spend: 100,
          cpcLink: null,
          clicksLink: 0,
          resultsConversations: 0,
          costPerResult: null,
        },
      ],
    });
    const buffer = await generateReportXlsx(baseWeek(), executive);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const campanhas = workbook.getWorksheet("Campanhas")!;
    const dataRow = campanhas.getRow(2);
    const cpcValue = dataRow.getCell("E").value;
    expect(typeof cpcValue === "number" ? Number.isNaN(cpcValue) : false).toBe(false);
  });
});
