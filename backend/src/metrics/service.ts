import { prisma } from "../prisma";
import { addDays, formatDateOnly, getWeekEnd, getWeekStart, toDateOnly } from "./weeks";

export type DailyMetricRow = {
  date: string;
  spend: number;
  resultsConversations: number;
  reach: number;
  impressions: number;
  frequency: number;
  clicksTotal: number;
  clicksLink: number;
  isDemo: boolean;
};

export type WeekTotals = {
  spend: number;
  resultsConversations: number;
  impressions: number;
  clicksTotal: number;
  clicksLink: number;
  costPerResult: number | null;
  ctr: number | null; // sobre cliques no link
  cpc: number | null; // sobre cliques no link
  cpm: number | null;
};

export type WeekSummary = {
  weekStart: string;
  weekEnd: string;
  daysAvailable: number;
  isPartial: boolean;
  isDemo: boolean;
  daily: DailyMetricRow[];
  totals: WeekTotals;
  reachNote: string;
};

function computeTotals(rows: DailyMetricRow[]): WeekTotals {
  const spend = rows.reduce((sum, r) => sum + r.spend, 0);
  const resultsConversations = rows.reduce((sum, r) => sum + r.resultsConversations, 0);
  const impressions = rows.reduce((sum, r) => sum + r.impressions, 0);
  const clicksTotal = rows.reduce((sum, r) => sum + r.clicksTotal, 0);
  const clicksLink = rows.reduce((sum, r) => sum + r.clicksLink, 0);

  return {
    spend,
    resultsConversations,
    impressions,
    clicksTotal,
    clicksLink,
    costPerResult: resultsConversations > 0 ? spend / resultsConversations : null,
    ctr: impressions > 0 ? (clicksLink / impressions) * 100 : null,
    cpc: clicksLink > 0 ? spend / clicksLink : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
  };
}

function toRow(record: {
  date: Date;
  spend: unknown;
  resultsConversations: number;
  reach: number;
  impressions: number;
  frequency: unknown;
  clicksTotal: number;
  clicksLink: number;
  isDemo: boolean;
}): DailyMetricRow {
  return {
    date: formatDateOnly(record.date),
    spend: Number(record.spend),
    resultsConversations: record.resultsConversations,
    reach: record.reach,
    impressions: record.impressions,
    frequency: Number(record.frequency),
    clicksTotal: record.clicksTotal,
    clicksLink: record.clicksLink,
    isDemo: record.isDemo,
  };
}

export async function getWeekSummary(weekStartInput: Date): Promise<WeekSummary> {
  const weekStart = getWeekStart(weekStartInput);
  const weekEnd = getWeekEnd(weekStart);

  const records = await prisma.dailyMetric.findMany({
    where: { date: { gte: weekStart, lte: weekEnd } },
    orderBy: { date: "asc" },
  });

  const daily = records.map(toRow);
  const today = toDateOnly(new Date());
  const daysExpected = Math.min(
    7,
    Math.floor((Math.min(weekEnd.getTime(), today.getTime()) - weekStart.getTime()) / 86400000) + 1
  );

  return {
    weekStart: formatDateOnly(weekStart),
    weekEnd: formatDateOnly(weekEnd),
    daysAvailable: daily.length,
    isPartial: daily.length < Math.max(daysExpected, daily.length) || daily.length < 7,
    isDemo: daily.some((d) => d.isDemo),
    daily,
    totals: computeTotals(daily),
    reachNote:
      "Alcance e frequência não são somados entre dias (evita contar a mesma pessoa mais de uma vez); consulte o valor diário no gráfico.",
  };
}

export async function listAvailableWeeks(limit = 12): Promise<
  { weekStart: string; weekEnd: string; daysAvailable: number; isPartial: boolean }[]
> {
  const records = await prisma.dailyMetric.findMany({
    select: { date: true },
    orderBy: { date: "desc" },
  });

  if (records.length === 0) return [];

  const weekStarts = new Map<string, number>();
  for (const record of records) {
    const key = formatDateOnly(getWeekStart(record.date));
    weekStarts.set(key, (weekStarts.get(key) ?? 0) + 1);
  }

  const sortedKeys = Array.from(weekStarts.keys()).sort((a, b) => (a < b ? 1 : -1));

  return sortedKeys.slice(0, limit).map((key) => {
    const weekStart = toDateOnly(new Date(`${key}T00:00:00.000Z`));
    const weekEnd = getWeekEnd(weekStart);
    const daysAvailable = weekStarts.get(key) ?? 0;
    return {
      weekStart: formatDateOnly(weekStart),
      weekEnd: formatDateOnly(weekEnd),
      daysAvailable,
      isPartial: daysAvailable < 7,
    };
  });
}

export async function compareWeeks(currentStart: Date, previousStart: Date) {
  const current = await getWeekSummary(currentStart);
  const previous = await getWeekSummary(previousStart);

  const comparableDays = Math.min(current.daysAvailable, previous.daysAvailable);

  const currentComparable = computeTotals(current.daily.slice(0, comparableDays));
  const previousComparable = computeTotals(previous.daily.slice(0, comparableDays));

  return {
    current,
    previous,
    comparableDays,
    comparisonNote:
      comparableDays < 7
        ? `Comparação restrita aos ${comparableDays} dia(s) disponíveis em ambas as semanas.`
        : null,
    currentComparable,
    previousComparable,
  };
}

export function shiftWeek(weekStart: Date, weeks: number): Date {
  return addDays(weekStart, weeks * 7);
}
