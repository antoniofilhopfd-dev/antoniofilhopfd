import path from "node:path";
import PDFDocument from "pdfkit";
import type { ReportData } from "./reportData";

// Layout do relatório PDF (Seção 13). Não há PDF de referência do
// protótipo disponível neste pacote — este layout é uma PROPOSTA
// seguindo a identidade visual já aplicada no restante da aplicação
// (Etapa 3), a ser aprovada/ajustada pelo usuário.

const NAVY = "#1e3a8a";
const NAVY_DARK = "#14265c";
const GOLD = "#f5820b";
const TEXT = "#2b2d3a";
const TEXT_MUTED = "#6b6f80";
const BORDER = "#e2e4ec";

const LOGO_PATH = path.join(__dirname, "..", "assets", "logo-horizontal-branca.png");

const PAGE_MARGIN = 40;

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numberFormatter = new Intl.NumberFormat("pt-BR");
const percentFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtCurrency(v: number | null): string {
  return v === null ? "indisponível" : currencyFormatter.format(v);
}
function fmtNumber(v: number | null): string {
  return v === null ? "indisponível" : numberFormatter.format(v);
}
function fmtPercent(v: number | null): string {
  return v === null ? "indisponível" : `${percentFormatter.format(v)}%`;
}
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function drawHeader(doc: PDFKit.PDFDocument, subtitle: string) {
  const headerHeight = 80;
  doc.rect(0, 0, doc.page.width, headerHeight).fill(NAVY);

  try {
    doc.image(LOGO_PATH, PAGE_MARGIN, 20, { height: 32 });
  } catch {
    // Segue sem logo se o arquivo não estiver disponível (não deve
    // acontecer em execução normal, mas evita quebrar a geração do PDF).
  }

  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("Relatório de Tráfego Pago", PAGE_MARGIN, 20, {
      align: "right",
      width: doc.page.width - PAGE_MARGIN * 2,
    });
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#e5e9f5")
    .text(subtitle, PAGE_MARGIN, 44, {
      align: "right",
      width: doc.page.width - PAGE_MARGIN * 2,
    });

  doc.rect(0, headerHeight, doc.page.width, 4).fill(GOLD);
  doc.fillColor(TEXT);
  doc.x = PAGE_MARGIN;
  doc.y = headerHeight + 20;
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 40);
  doc.x = PAGE_MARGIN;
  doc.moveDown(0.5);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(NAVY_DARK)
    .text(text, PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 });
  doc.moveTo(PAGE_MARGIN, doc.y + 2).lineTo(doc.page.width - PAGE_MARGIN, doc.y + 2).strokeColor(GOLD).lineWidth(1.5).stroke();
  doc.moveDown(0.8);
  doc.x = PAGE_MARGIN;
  doc.fillColor(TEXT).font("Helvetica").fontSize(9);
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  columnWidths: number[]
) {
  const rowHeight = 20;
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);

  function drawRow(cells: string[], y: number, isHeader: boolean) {
    let x = PAGE_MARGIN;
    doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    if (isHeader) {
      doc.rect(PAGE_MARGIN, y, totalWidth, rowHeight).fill(NAVY);
      doc.fillColor("#ffffff");
    } else {
      doc.fillColor(TEXT);
    }
    cells.forEach((cell, i) => {
      doc.text(cell, x + 4, y + 6, { width: columnWidths[i] - 8, ellipsis: true });
      x += columnWidths[i];
    });
    doc.fillColor(TEXT);
  }

  ensureSpace(doc, rowHeight * 2);
  drawRow(headers, doc.y, true);
  doc.y += rowHeight;

  rows.forEach((row, index) => {
    ensureSpace(doc, rowHeight);
    if (doc.y === PAGE_MARGIN) {
      // Página nova: repete o cabeçalho para não perder contexto.
      drawRow(headers, doc.y, true);
      doc.y += rowHeight;
    }
    const y = doc.y;
    if (index % 2 === 1) {
      doc.rect(PAGE_MARGIN, y, totalWidth, rowHeight).fillColor("#f7f8fb").fill();
      doc.fillColor(TEXT);
    }
    drawRow(row, y, false);
    doc.moveTo(PAGE_MARGIN, y + rowHeight).lineTo(PAGE_MARGIN + totalWidth, y + rowHeight).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.y = y + rowHeight;
  });

  doc.x = PAGE_MARGIN;
  doc.moveDown(1);
}

function drawDailyChart(doc: PDFKit.PDFDocument, daily: ReportData["week"]["daily"]) {
  if (daily.length === 0) return;

  const chartWidth = doc.page.width - PAGE_MARGIN * 2;
  const chartHeight = 110;
  ensureSpace(doc, chartHeight + 30);

  const top = doc.y;
  const maxSpend = Math.max(...daily.map((d) => d.spend), 1);
  const barWidth = chartWidth / daily.length;

  daily.forEach((d, i) => {
    const barHeight = (d.spend / maxSpend) * (chartHeight - 20);
    const x = PAGE_MARGIN + i * barWidth + barWidth * 0.15;
    const y = top + (chartHeight - 20) - barHeight;
    doc.rect(x, y, barWidth * 0.7, barHeight).fill(GOLD);
    doc
      .fillColor(TEXT_MUTED)
      .font("Helvetica")
      .fontSize(7)
      .text(fmtDate(d.date).slice(0, 5), PAGE_MARGIN + i * barWidth, top + chartHeight - 16, {
        width: barWidth,
        align: "center",
      });
  });

  doc.fillColor(TEXT);
  doc.x = PAGE_MARGIN;
  doc.y = top + chartHeight + 10;
}

function addPageNumbers(doc: PDFKit.PDFDocument): number {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);

    // O rodapé fica dentro da margem inferior; sem isso, o PDFKit
    // interpreta a escrita ali como estouro de conteúdo e cria páginas
    // extras em branco automaticamente (Seção 13 proíbe páginas vazias).
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(TEXT_MUTED)
      .text(`Página ${i + 1} de ${range.count}`, 0, doc.page.height - 30, {
        align: "center",
        width: doc.page.width,
        lineBreak: false,
      });

    doc.page.margins.bottom = originalBottomMargin;
  }

  return range.count;
}

export function generateReportPdf(data: ReportData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });

  const periodLabel = `${fmtDate(data.week.weekStart)} a ${fmtDate(data.week.weekEnd)} — ${
    data.week.isPartial ? `parcial (${data.week.daysAvailable} de 7 dias)` : "completa"
  }${data.week.isDemo ? " — DADOS DE DEMONSTRAÇÃO" : ""}`;

  drawHeader(doc, periodLabel);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text(`Gerado em ${fmtDateTime(new Date())}`, PAGE_MARGIN, doc.y, {
      width: doc.page.width - PAGE_MARGIN * 2,
    });
  doc.moveDown(0.5);

  sectionTitle(doc, "Visão geral");
  const kpis: [string, string][] = [
    ["Investimento", fmtCurrency(data.week.totals.spend)],
    ["Resultados (conversas iniciadas)", fmtNumber(data.week.totals.resultsConversations)],
    ["Custo por resultado", fmtCurrency(data.week.totals.costPerResult)],
    ["Impressões", fmtNumber(data.week.totals.impressions)],
    ["Cliques totais", fmtNumber(data.week.totals.clicksTotal)],
    ["Cliques no link", fmtNumber(data.week.totals.clicksLink)],
    ["CTR (sobre cliques no link)", fmtPercent(data.week.totals.ctr)],
    ["CPC (sobre cliques no link)", fmtCurrency(data.week.totals.cpc)],
    ["CPM", fmtCurrency(data.week.totals.cpm)],
  ];
  drawTable(
    doc,
    ["Indicador", "Valor"],
    kpis.map(([k, v]) => [k, v]),
    [280, doc.page.width - PAGE_MARGIN * 2 - 280]
  );

  sectionTitle(doc, "Investimento e resultados por dia");
  drawDailyChart(doc, data.week.daily);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text(
      "Alcance e frequência não são somados entre dias (evita contar a mesma pessoa mais de uma vez); consulte a tela para o valor diário.",
      PAGE_MARGIN,
      doc.y,
      { width: doc.page.width - PAGE_MARGIN * 2 }
    );

  sectionTitle(doc, "Campanhas");
  if (data.campaigns.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text("Nenhuma campanha no período.", PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 });
  } else {
    drawTable(
      doc,
      ["Campanha", "Status", "Investimento", "Resultados", "CTR"],
      data.campaigns.map((c) => [
        c.name,
        c.status,
        fmtCurrency(c.totals.spend),
        fmtNumber(c.totals.resultsConversations),
        fmtPercent(c.totals.ctr),
      ]),
      [220, 70, 90, 80, 60]
    );
  }

  sectionTitle(doc, "Conjuntos");
  const allAdSets = data.campaigns.flatMap((c) => c.adSets.map((s) => ({ ...s, campaignName: c.name })));
  if (allAdSets.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text("Nenhum conjunto no período.", PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 });
  } else {
    drawTable(
      doc,
      ["Conjunto", "Campanha", "Investimento", "Resultados"],
      allAdSets.map((s) => [s.name, s.campaignName, fmtCurrency(s.totals.spend), fmtNumber(s.totals.resultsConversations)]),
      [180, 180, 90, 70]
    );
  }

  sectionTitle(doc, "Anúncios");
  const allAds = data.campaigns.flatMap((c) => c.adSets.flatMap((s) => s.ads.map((a) => ({ ...a, adSetName: s.name }))));
  if (allAds.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text("Nenhum anúncio no período.", PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 });
  } else {
    drawTable(
      doc,
      ["Anúncio", "Conjunto", "Investimento", "Resultados"],
      allAds.map((a) => [a.name, a.adSetName, fmtCurrency(a.totals.spend), fmtNumber(a.totals.resultsConversations)]),
      [180, 180, 90, 70]
    );
  }

  sectionTitle(doc, "Observações do gestor");
  if (data.observations.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text("Nenhuma observação registrada para esta semana.", PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 });
  } else {
    const contentWidth = doc.page.width - PAGE_MARGIN * 2;
    data.observations.forEach((obs) => {
      ensureSpace(doc, 40);
      doc.x = PAGE_MARGIN;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(NAVY_DARK)
        .text(`${obs.authorName} — ${fmtDateTime(obs.createdAt)}`, PAGE_MARGIN, doc.y, { width: contentWidth });
      doc.x = PAGE_MARGIN;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(TEXT)
        .text(obs.text, PAGE_MARGIN, doc.y, { width: contentWidth });
      doc.x = PAGE_MARGIN;
      doc.moveDown(0.6);
    });
  }

  // Exposto só para verificação em teste (regressão de páginas em branco
  // criadas pelo próprio rodapé de numeração); não usado em produção.
  const pageCountBeforeFooters = doc.bufferedPageRange().count;
  const pageCount = addPageNumbers(doc);
  (
    doc as PDFKit.PDFDocument & { reportPageCount?: number; reportPageCountBeforeFooters?: number }
  ).reportPageCount = pageCount;
  (
    doc as PDFKit.PDFDocument & { reportPageCount?: number; reportPageCountBeforeFooters?: number }
  ).reportPageCountBeforeFooters = pageCountBeforeFooters;
  doc.end();
  return doc;
}
