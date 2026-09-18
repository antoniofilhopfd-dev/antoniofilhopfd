import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../prisma";
import { compareWeeks, getWeekSummary, listAvailableWeeks } from "./service";
import { formatDateOnly, getWeekStart } from "./weeks";

beforeEach(async () => {
  await prisma.dailyMetric.deleteMany();
});

afterAll(async () => {
  await prisma.dailyMetric.deleteMany();
  await prisma.$disconnect();
});

// Segunda-feira de referência: 2026-01-05. Semana correspondente: domingo
// 2026-01-04 a sábado 2026-01-10.
const REFERENCE_MONDAY = new Date("2026-01-05T00:00:00.000Z");

async function seedDay(dateIso: string, overrides: Partial<{
  spend: number;
  resultsConversations: number;
  reach: number;
  impressions: number;
  frequency: number;
  clicksTotal: number;
  clicksLink: number;
}> = {}) {
  await prisma.dailyMetric.create({
    data: {
      date: new Date(`${dateIso}T00:00:00.000Z`),
      spend: overrides.spend ?? 100,
      resultsConversations: overrides.resultsConversations ?? 5,
      reach: overrides.reach ?? 800,
      impressions: overrides.impressions ?? 1000,
      frequency: overrides.frequency ?? 1.25,
      clicksTotal: overrides.clicksTotal ?? 30,
      clicksLink: overrides.clicksLink ?? 20,
      isDemo: true,
    },
  });
}

describe("getWeekSummary", () => {
  it("soma corretamente os totais aditivos de uma semana completa", async () => {
    await seedDay("2026-01-04", { spend: 100, resultsConversations: 4, impressions: 1000, clicksLink: 20 });
    await seedDay("2026-01-05", { spend: 200, resultsConversations: 6, impressions: 2000, clicksLink: 40 });

    const summary = await getWeekSummary(REFERENCE_MONDAY);

    expect(summary.weekStart).toBe("2026-01-04");
    expect(summary.weekEnd).toBe("2026-01-10");
    expect(summary.daysAvailable).toBe(2);
    expect(summary.totals.spend).toBe(300);
    expect(summary.totals.resultsConversations).toBe(10);
    expect(summary.totals.costPerResult).toBe(30);
    // CTR sobre cliques no link: 60 / 3000 * 100 = 2%
    expect(summary.totals.ctr).toBeCloseTo(2, 5);
  });

  it("marca semana como parcial quando há menos de 7 dias de dado", async () => {
    await seedDay("2026-01-04");
    const summary = await getWeekSummary(REFERENCE_MONDAY);
    expect(summary.isPartial).toBe(true);
  });

  it("retorna totais zerados (não indisponíveis) quando não há registros", async () => {
    const summary = await getWeekSummary(REFERENCE_MONDAY);
    expect(summary.daysAvailable).toBe(0);
    expect(summary.totals.spend).toBe(0);
    expect(summary.totals.costPerResult).toBeNull();
  });
});

describe("compareWeeks", () => {
  it("restringe a comparação ao número de dias disponíveis em ambas as semanas", async () => {
    // Semana atual: 2 dias. Semana anterior: 3 dias.
    await seedDay("2026-01-04", { spend: 100 });
    await seedDay("2026-01-05", { spend: 100 });

    await seedDay("2025-12-28", { spend: 50 });
    await seedDay("2025-12-29", { spend: 50 });
    await seedDay("2025-12-30", { spend: 50 });

    const comparison = await compareWeeks(REFERENCE_MONDAY, new Date("2025-12-28T00:00:00.000Z"));

    expect(comparison.comparableDays).toBe(2);
    expect(comparison.currentComparable.spend).toBe(200);
    expect(comparison.previousComparable.spend).toBe(100);
    expect(comparison.comparisonNote).toContain("2 dia");
  });
});

describe("listAvailableWeeks", () => {
  it("agrupa os dias em semanas e reporta quantos dias cada uma tem", async () => {
    await seedDay("2026-01-04");
    await seedDay("2026-01-05");
    await seedDay("2025-12-28");

    const weeks = await listAvailableWeeks();

    expect(weeks).toHaveLength(2);
    const currentWeek = weeks.find((w) => w.weekStart === formatDateOnly(getWeekStart(REFERENCE_MONDAY)));
    expect(currentWeek?.daysAvailable).toBe(2);
    expect(currentWeek?.isPartial).toBe(true);
  });
});
