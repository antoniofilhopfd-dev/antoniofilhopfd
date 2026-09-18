import { describe, expect, it } from "vitest";
import { generateReportCsv } from "./csv";
import type { ReportData } from "./reportData";

function baseData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    week: {
      weekStart: "2026-01-04",
      weekEnd: "2026-01-10",
      daysAvailable: 7,
      isPartial: false,
      isDemo: true,
      daily: [],
      totals: {
        spend: 1234.5,
        resultsConversations: 42,
        impressions: 10000,
        clicksTotal: 300,
        clicksLink: 200,
        costPerResult: 29.39,
        ctr: 2.5,
        cpc: 6.17,
        cpm: 12.34,
      },
      reachNote: "",
    },
    campaigns: [],
    observations: [],
    ...overrides,
  };
}

describe("generateReportCsv", () => {
  it("inclui BOM UTF-8 e cabeçalho do relatório", () => {
    const csv = generateReportCsv(baseData());
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Relatório de Tráfego Pago");
  });

  it("formata valores monetários em pt-BR (vírgula decimal)", () => {
    const csv = generateReportCsv(baseData());
    expect(csv).toContain("1234,50");
  });

  it("protege campo de texto que começa com = contra injeção de fórmula", () => {
    const csv = generateReportCsv(
      baseData({
        observations: [
          { id: "1", text: "=SOMA(A1:A10)", createdAt: new Date("2026-01-05T10:00:00.000Z"), authorName: "Gestor" },
        ],
      })
    );
    expect(csv).toContain("'=SOMA(A1:A10)");
  });

  it("não altera números legítimos ao escapar campos", () => {
    const csv = generateReportCsv(
      baseData({
        campaigns: [
          {
            id: "c1",
            name: "Campanha -50% off",
            status: "ACTIVE" as never,
            segment: null,
            totals: {
              spend: 100,
              resultsConversations: 5,
              impressions: 1000,
              clicksTotal: 30,
              clicksLink: 20,
              costPerResult: 20,
              ctr: 2,
              cpc: 5,
              cpm: 10,
            },
            adSets: [],
          },
        ],
      })
    );
    // O nome da campanha começa com letra maiúscula "C", não deve ser escapado.
    expect(csv).toContain("Campanha -50% off");
    expect(csv).not.toContain("'Campanha -50% off");
  });
});
