import type { ReportData } from "./reportData";

// CSV compatível com Excel (BOM UTF-8, separador ";" — comum em
// configurações pt-BR do Excel, onde "," é o separador decimal).
// Campos de texto que começam com =, +, -, @ são prefixados com aspas
// simples para evitar injeção de fórmula, sem alterar números legítimos.

const BOM = "﻿";

function escapeCell(value: string): string {
  let v = value;
  if (/^[=+\-@]/.test(v)) {
    v = `'${v}`;
  }
  if (v.includes(";") || v.includes('"') || v.includes("\n")) {
    v = `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function money(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function row(cells: (string | number)[]): string {
  return cells.map((c) => escapeCell(String(c))).join(";");
}

export function generateReportCsv(data: ReportData): string {
  const lines: string[] = [];

  lines.push(row(["Relatório de Tráfego Pago"]));
  lines.push(row(["Período", `${data.week.weekStart} a ${data.week.weekEnd}`]));
  lines.push(row(["Semana", data.week.isPartial ? "Parcial" : "Completa"]));
  lines.push(row(["Origem dos dados", data.week.isDemo ? "Demonstração" : "Meta"]));
  lines.push("");

  lines.push(row(["Indicador", "Valor"]));
  lines.push(row(["Investimento", money(data.week.totals.spend)]));
  lines.push(row(["Resultados (conversas iniciadas)", data.week.totals.resultsConversations]));
  lines.push(row(["Impressões", data.week.totals.impressions]));
  lines.push(row(["Cliques totais", data.week.totals.clicksTotal]));
  lines.push(row(["Cliques no link", data.week.totals.clicksLink]));
  lines.push(
    row(["CTR (%, sobre cliques no link)", data.week.totals.ctr !== null ? money(data.week.totals.ctr) : ""])
  );
  lines.push(row(["CPC (sobre cliques no link)", data.week.totals.cpc !== null ? money(data.week.totals.cpc) : ""]));
  lines.push(row(["CPM", data.week.totals.cpm !== null ? money(data.week.totals.cpm) : ""]));
  lines.push("");

  lines.push(row(["Campanha", "Status", "Segmento", "Investimento", "Resultados", "CTR (%)"]));
  for (const c of data.campaigns) {
    lines.push(
      row([
        c.name,
        c.status,
        c.segment ?? "",
        money(c.totals.spend),
        c.totals.resultsConversations,
        c.totals.ctr !== null ? money(c.totals.ctr) : "",
      ])
    );
  }
  lines.push("");

  lines.push(row(["Conjunto", "Campanha", "Investimento", "Resultados"]));
  for (const c of data.campaigns) {
    for (const s of c.adSets) {
      lines.push(row([s.name, c.name, money(s.totals.spend), s.totals.resultsConversations]));
    }
  }
  lines.push("");

  lines.push(row(["Anúncio", "Conjunto", "Investimento", "Resultados"]));
  for (const c of data.campaigns) {
    for (const s of c.adSets) {
      for (const a of s.ads) {
        lines.push(row([a.name, s.name, money(a.totals.spend), a.totals.resultsConversations]));
      }
    }
  }
  lines.push("");

  lines.push(row(["Observações"]));
  lines.push(row(["Autor", "Data", "Texto"]));
  for (const o of data.observations) {
    lines.push(row([o.authorName, o.createdAt.toISOString(), o.text]));
  }

  return BOM + lines.join("\r\n");
}
