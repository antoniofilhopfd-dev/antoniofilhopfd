import ExcelJS from "exceljs";
import type { ExecutiveReport } from "./executiveData";
import type { WeekSummary } from "../metrics/service";

// Estrutura baseada no Excel de referência (Relatorio_Campanhas_Marketing.xlsx):
// aba Resumo + aba Campanhas, sem abas técnicas adicionais (Seção 26/29).

const NAVY = "FF1E3A8A";
const HEADER_FONT = { color: { argb: "FFFFFFFF" }, bold: true };
const CURRENCY_FORMAT = '"R$" #,##0.00';

const SEGMENT_LABEL: Record<string, string> = {
  EDUCACAO_INFANTIL: "Educação Infantil",
  ANOS_INICIAIS: "Anos Iniciais",
  ANOS_FINAIS: "Anos Finais",
  ENSINO_MEDIO: "Ensino Médio",
  INSTITUCIONAL: "Institucional",
  OUTROS: "Outros",
  SEM_CLASSIFICACAO: "Sem classificação",
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle" };
  });
}

export async function generateReportXlsx(
  week: WeekSummary,
  executive: ExecutiveReport
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Evolução Tráfego";
  workbook.created = new Date();

  // --- Aba Resumo ---
  const resumo = workbook.addWorksheet("Resumo");
  resumo.columns = [
    { header: "Campo", key: "campo", width: 28 },
    { header: "Valor", key: "valor", width: 24 },
  ];
  styleHeaderRow(resumo.getRow(1));

  const periodo = `${week.weekStart} a ${week.weekEnd}`;
  resumo.addRow({ campo: "Período", valor: periodo });
  resumo.addRow({ campo: "Semana", valor: week.isPartial ? "Parcial" : "Completa" });
  resumo.addRow({ campo: "Origem dos dados", valor: week.isDemo ? "Demonstração" : "Meta Ads" });
  resumo.addRow({ campo: "Data de geração", valor: new Date() });
  resumo.getRow(5).getCell(2).numFmt = "dd/mm/yyyy hh:mm";
  resumo.addRow({});

  const summaryRows: { campo: string; valor: number | string | null; fmt?: string }[] = [
    { campo: "Investimento Total", valor: week.totals.spend, fmt: CURRENCY_FORMAT },
    { campo: "CPC de Link", valor: week.totals.cpc, fmt: CURRENCY_FORMAT },
    { campo: "Alcance Total", valor: executive.reachAvailable ? null : "Indisponível (não somado entre dias)" },
    { campo: "Cliques no Link", valor: week.totals.clicksLink },
    { campo: "Conversas Iniciadas", valor: week.totals.resultsConversations },
    { campo: "Custo por Conversa", valor: week.totals.costPerResult, fmt: CURRENCY_FORMAT },
  ];
  for (const item of summaryRows) {
    const row = resumo.addRow({ campo: item.campo, valor: item.valor ?? "Indisponível" });
    if (item.fmt && typeof item.valor === "number") {
      row.getCell(2).numFmt = item.fmt;
    }
  }

  resumo.getColumn(1).font = { bold: true };

  // --- Aba Campanhas ---
  const campanhas = workbook.addWorksheet("Campanhas");
  campanhas.columns = [
    { header: "Criativo/Campanha", key: "nome", width: 32 },
    { header: "Campanha", key: "campanha", width: 32 },
    { header: "Público/Segmento", key: "segmento", width: 20 },
    { header: "Investimento", key: "spend", width: 16 },
    { header: "CPC de Link", key: "cpc", width: 14 },
    { header: "Alcance", key: "alcance", width: 14 },
    { header: "Cliques no Link", key: "clicksLink", width: 16 },
    { header: "Conversas Iniciadas", key: "conversas", width: 18 },
    { header: "Custo por Conversa", key: "custoConversa", width: 18 },
  ];
  styleHeaderRow(campanhas.getRow(1));
  campanhas.autoFilter = {
    from: "A1",
    to: "I1",
  };

  for (const c of executive.campaigns) {
    const row = campanhas.addRow({
      nome: c.name,
      campanha: c.name,
      segmento: c.segment ? SEGMENT_LABEL[c.segment] ?? c.segment : "Sem classificação",
      spend: c.spend,
      cpc: c.cpcLink,
      alcance: "Indisponível",
      clicksLink: c.clicksLink,
      conversas: c.resultsConversations,
      custoConversa: c.costPerResult,
    });
    row.getCell("spend").numFmt = CURRENCY_FORMAT;
    if (c.cpcLink !== null) row.getCell("cpc").numFmt = CURRENCY_FORMAT;
    if (c.costPerResult !== null) row.getCell("custoConversa").numFmt = CURRENCY_FORMAT;
  }

  return workbook.xlsx.writeBuffer();
}
