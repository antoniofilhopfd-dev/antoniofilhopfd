import { describe, expect, it } from "vitest";
import { generateReportPdf } from "./pdf";
import type { ReportData } from "./reportData";

function buildData(campaignCount: number): ReportData {
  const daily = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-01-0${4 + i}`,
    spend: 100 + i * 10,
    resultsConversations: 5 + i,
    reach: 800,
    impressions: 1000 + i * 50,
    frequency: 1.2,
    clicksTotal: 30,
    clicksLink: 20,
    isDemo: true,
  }));

  const campaigns = Array.from({ length: campaignCount }, (_, i) => ({
    id: `camp-${i}`,
    name: `Campanha de teste número ${i} com nome razoavelmente longo`,
    status: "ACTIVE" as never,
    segment: null,
    totals: {
      spend: 500,
      resultsConversations: 20,
      impressions: 5000,
      clicksTotal: 100,
      clicksLink: 80,
      costPerResult: 25,
      ctr: 1.6,
      cpc: 6.25,
      cpm: 100,
    },
    adSets: [
      {
        id: `adset-${i}`,
        name: `Conjunto ${i}`,
        status: "ACTIVE" as never,
        totals: {
          spend: 500,
          resultsConversations: 20,
          impressions: 5000,
          clicksTotal: 100,
          clicksLink: 80,
          costPerResult: 25,
          ctr: 1.6,
          cpc: 6.25,
          cpm: 100,
        },
        ads: [
          {
            id: `ad-${i}`,
            name: `Anúncio ${i}`,
            status: "ACTIVE" as never,
            totals: {
              spend: 500,
              resultsConversations: 20,
              impressions: 5000,
              clicksTotal: 100,
              clicksLink: 80,
              costPerResult: 25,
              ctr: 1.6,
              cpc: 6.25,
              cpm: 100,
            },
          },
        ],
      },
    ],
  }));

  return {
    week: {
      weekStart: "2026-01-04",
      weekEnd: "2026-01-10",
      daysAvailable: 7,
      isPartial: false,
      isDemo: true,
      daily,
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
      reachNote: "nota",
    },
    campaigns,
    observations: [
      { id: "o1", text: "Observação de teste.", createdAt: new Date("2026-01-06T12:00:00.000Z"), authorName: "Gestor Teste" },
    ],
  };
}

async function collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

describe("generateReportPdf", () => {
  it("gera um PDF válido e não vazio para um relatório pequeno", async () => {
    const doc = generateReportPdf(buildData(1));
    const buffer = await collectPdfBuffer(doc);

    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("gera múltiplas páginas sem lançar erro quando há muitas campanhas/conjuntos/anúncios", async () => {
    const doc = generateReportPdf(buildData(40));
    const buffer = await collectPdfBuffer(doc);

    expect(buffer.length).toBeGreaterThan(1000);
    // %%EOF marca o fim de um PDF válido gerado com sucesso.
    expect(buffer.subarray(-2048).toString("latin1")).toContain("%%EOF");
  });

  it("não deixa páginas em branco sobrando após numerar as páginas (regressão)", async () => {
    // O rodapé de numeração é escrito dentro da margem inferior; sem o
    // ajuste de margem em addPageNumbers, o PDFKit interpretava isso como
    // estouro de conteúdo e criava páginas extras em branco a cada
    // execução do laço de rodapés — a contagem de páginas ANTES e DEPOIS
    // de desenhar os rodapés deve ser idêntica.
    const doc = generateReportPdf(buildData(1)) as PDFKit.PDFDocument & {
      reportPageCount?: number
      reportPageCountBeforeFooters?: number
    };
    await collectPdfBuffer(doc);

    expect(doc.reportPageCount).toBe(doc.reportPageCountBeforeFooters);
  });
});
