import path from "node:path";
import PDFDocument from "pdfkit";
import type { ReportData } from "./reportData";
import type { ExecutiveReport } from "./executiveData";

const SEGMENT_LABEL: Record<string, string> = {
  EDUCACAO_INFANTIL: "Educação Infantil",
  ANOS_INICIAIS: "Anos Iniciais",
  ANOS_FINAIS: "Anos Finais",
  ENSINO_MEDIO: "Ensino Médio",
  INSTITUCIONAL: "Institucional",
  OUTROS: "Outros",
  SEM_CLASSIFICACAO: "Sem classificação",
};

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
      // "height" é obrigatório para o PDFKit truncar com reticências em
      // vez de quebrar linha e vazar para a linha da tabela seguinte
      // (bug real encontrado ao renderizar o PDF: nomes de campanha
      // longos sobrepunham a linha abaixo).
      doc.text(cell, x + 4, y + 6, {
        width: columnWidths[i] - 8,
        height: rowHeight - 8,
        ellipsis: true,
        lineBreak: false,
      });
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

function deltaText(current: number, previous: number): string {
  if (previous === 0) return "—";
  const delta = ((current - previous) / previous) * 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

// Relatório Executivo (incremento "área de relatórios"). Reaproveita
// INTEGRALMENTE o cabeçalho e os helpers de layout do relatório básico
// (drawHeader, sectionTitle, drawTable, drawDailyChart, addPageNumbers)
// — nada no cabeçalho foi redesenhado.
export function generateExecutivePdf(data: ReportData, executive: ExecutiveReport): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });

  const periodLabel = `${fmtDate(data.week.weekStart)} a ${fmtDate(data.week.weekEnd)} — ${
    data.week.isPartial ? `parcial (${data.week.daysAvailable} de 7 dias)` : "completa"
  }${data.week.isDemo ? " — DADOS DE DEMONSTRAÇÃO" : ""}`;

  drawHeader(doc, periodLabel);

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(TEXT_MUTED)
    .text(`Gerado em ${fmtDateTime(new Date())} · Relatório Executivo`, PAGE_MARGIN, doc.y, {
      width: doc.page.width - PAGE_MARGIN * 2,
    });
  doc.moveDown(0.5);

  sectionTitle(doc, "Resumo");
  const kpis: [string, string][] = [
    ["Investimento", fmtCurrency(data.week.totals.spend)],
    ["Conversas iniciadas", fmtNumber(data.week.totals.resultsConversations)],
    ["Custo por conversa", fmtCurrency(data.week.totals.costPerResult)],
    ["Alcance", executive.reachAvailable ? "—" : "indisponível (não somado entre dias)"],
    ["Cliques no link", fmtNumber(data.week.totals.clicksLink)],
    ["CPC de link", fmtCurrency(data.week.totals.cpc)],
  ];
  drawTable(
    doc,
    ["Indicador", "Valor"],
    kpis.map(([k, v]) => [k, v]),
    [280, doc.page.width - PAGE_MARGIN * 2 - 280]
  );

  sectionTitle(doc, "Comparação com semana anterior");
  if (executive.comparison.comparisonNote) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(TEXT_MUTED)
      .text(executive.comparison.comparisonNote, PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
    doc.x = PAGE_MARGIN;
    doc.moveDown(0.4);
  }
  drawTable(
    doc,
    ["Métrica", "Atual", "Anterior", "Variação"],
    [
      [
        "Investimento",
        fmtCurrency(executive.comparison.currentComparable.spend),
        fmtCurrency(executive.comparison.previousComparable.spend),
        deltaText(executive.comparison.currentComparable.spend, executive.comparison.previousComparable.spend),
      ],
      [
        "Conversas",
        fmtNumber(executive.comparison.currentComparable.resultsConversations),
        fmtNumber(executive.comparison.previousComparable.resultsConversations),
        deltaText(
          executive.comparison.currentComparable.resultsConversations,
          executive.comparison.previousComparable.resultsConversations
        ),
      ],
      [
        "Custo por conversa",
        fmtCurrency(executive.comparison.currentComparable.costPerResult),
        fmtCurrency(executive.comparison.previousComparable.costPerResult),
        executive.comparison.currentComparable.costPerResult !== null &&
        executive.comparison.previousComparable.costPerResult !== null
          ? deltaText(
              executive.comparison.currentComparable.costPerResult,
              executive.comparison.previousComparable.costPerResult
            )
          : "—",
      ],
      [
        "Cliques no link",
        fmtNumber(executive.comparison.currentComparable.clicksLink),
        fmtNumber(executive.comparison.previousComparable.clicksLink),
        deltaText(executive.comparison.currentComparable.clicksLink, executive.comparison.previousComparable.clicksLink),
      ],
    ],
    [160, 110, 110, doc.page.width - PAGE_MARGIN * 2 - 380]
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
  if (executive.campaigns.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text("Nenhuma campanha no período.", PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 });
  } else {
    drawTable(
      doc,
      ["Campanha", "Segmento", "Investimento", "CPC link", "Cliques link", "Conversas", "Custo/conversa"],
      executive.campaigns.map((c) => [
        c.name,
        c.segment ? SEGMENT_LABEL[c.segment] ?? c.segment : "Sem classificação",
        fmtCurrency(c.spend),
        fmtCurrency(c.cpcLink),
        fmtNumber(c.clicksLink),
        fmtNumber(c.resultsConversations),
        fmtCurrency(c.costPerResult),
      ]),
      [110, 90, 75, 65, 65, 65, 80]
    );
  }

  sectionTitle(doc, "Distribuição do investimento");
  if (executive.distribution.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text("Sem investimento registrado no período.", PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
  } else {
    drawTable(
      doc,
      ["Campanha", "Investimento", "% do total"],
      executive.distribution.map((d) => [d.campaignName, fmtCurrency(d.spend), `${d.percent.toFixed(1)}%`]),
      [260, 120, doc.page.width - PAGE_MARGIN * 2 - 380]
    );
  }

  sectionTitle(doc, "Desempenho por segmento");
  if (executive.segments.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text("Sem dados de segmento no período.", PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
  } else {
    drawTable(
      doc,
      ["Segmento", "Investimento", "Conversas", "Custo/conversa", "CPC link"],
      executive.segments.map((s) => [
        SEGMENT_LABEL[s.segment] ?? s.segment,
        fmtCurrency(s.spend),
        fmtNumber(s.resultsConversations),
        fmtCurrency(s.costPerResult),
        fmtCurrency(s.cpcLink),
      ]),
      [110, 90, 80, 90, 80]
    );
  }

  sectionTitle(doc, "Destaques da semana");
  const highlightLines: string[] = [];
  if (executive.highlights.topSpend) {
    highlightLines.push(
      `Maior investimento: ${executive.highlights.topSpend.campaignName} — ${fmtCurrency(executive.highlights.topSpend.spend)}`
    );
  }
  if (executive.highlights.topConversations) {
    highlightLines.push(
      `Maior número de conversas: ${executive.highlights.topConversations.campaignName} — ${fmtNumber(
        executive.highlights.topConversations.resultsConversations
      )}`
    );
  }
  if (executive.highlights.lowestCostPerResult) {
    highlightLines.push(
      `Menor custo por conversa: ${executive.highlights.lowestCostPerResult.campaignName} — ${fmtCurrency(
        executive.highlights.lowestCostPerResult.costPerResult
      )}`
    );
  }
  if (highlightLines.length === 0) {
    highlightLines.push("Sem destaques calculáveis no período.");
  }
  for (const line of highlightLines) {
    ensureSpace(doc, 16);
    doc.x = PAGE_MARGIN;
    doc.font("Helvetica").fontSize(9).fillColor(TEXT).text(line, PAGE_MARGIN, doc.y, {
      width: doc.page.width - PAGE_MARGIN * 2,
    });
    doc.x = PAGE_MARGIN;
  }

  sectionTitle(doc, "Observações");
  if (data.observations.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text("Nenhuma observação registrada para esta semana.", PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
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
      doc.font("Helvetica").fontSize(9).fillColor(TEXT).text(obs.text, PAGE_MARGIN, doc.y, { width: contentWidth });
      doc.x = PAGE_MARGIN;
      doc.moveDown(0.6);
    });
  }

  sectionTitle(doc, "Conclusão do responsável");
  if (executive.conclusion) {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(NAVY_DARK)
      .text(`${executive.conclusion.authorName} — ${fmtDateTime(executive.conclusion.updatedAt)}`, PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
    doc.x = PAGE_MARGIN;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(TEXT)
      .text(executive.conclusion.text, PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 });
  } else {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text("Conclusão ainda não registrada para esta semana.", PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
      });
  }

  addPageNumbers(doc);
  doc.end();
  return doc;
}
