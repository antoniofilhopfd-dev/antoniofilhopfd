import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { EntityStatus, Segment, UserRole } from "@prisma/client";
import { prisma } from "../prisma";
import { hashPassword } from "../auth/password";
import { getExecutiveReport } from "./executiveData";

const CURRENT_WEEK_MONDAY = new Date("2026-01-05T00:00:00.000Z"); // semana 2026-01-04 a 01-10
const PREVIOUS_WEEK_MONDAY = new Date("2025-12-29T00:00:00.000Z"); // semana 2025-12-28 a 01-03

beforeEach(async () => {
  await prisma.adDailyMetric.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.dailyMetric.deleteMany();
  await prisma.reportConclusion.deleteMany();
  await prisma.weeklyObservation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.adDailyMetric.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.dailyMetric.deleteMany();
  await prisma.reportConclusion.deleteMany();
  await prisma.weeklyObservation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

async function seedCampaignWithMetrics(opts: {
  externalId: string;
  name: string;
  segment: Segment | null;
  date: Date;
  spend: number;
  resultsConversations: number;
  clicksLink: number;
}) {
  const campaign = await prisma.campaign.create({
    data: {
      externalId: opts.externalId,
      name: opts.name,
      status: EntityStatus.ACTIVE,
      objective: "OUTCOME_TRAFFIC",
      segment: opts.segment,
      isDemo: true,
    },
  });
  const adSet = await prisma.adSet.create({
    data: {
      externalId: `${opts.externalId}-adset`,
      campaignId: campaign.id,
      name: `${opts.name} - conjunto`,
      status: EntityStatus.ACTIVE,
      dailyBudget: 10,
      isDemo: true,
    },
  });
  const ad = await prisma.ad.create({
    data: {
      externalId: `${opts.externalId}-ad`,
      adSetId: adSet.id,
      name: `${opts.name} - anúncio`,
      status: EntityStatus.ACTIVE,
      isDemo: true,
    },
  });
  await prisma.adDailyMetric.create({
    data: {
      adId: ad.id,
      date: opts.date,
      spend: opts.spend,
      resultsConversations: opts.resultsConversations,
      reach: 500,
      impressions: 1000,
      frequency: 1.2,
      clicksTotal: opts.clicksLink + 5,
      clicksLink: opts.clicksLink,
      isDemo: true,
    },
  });
  return campaign;
}

// A comparação semanal (Investimento/Conversas/Cliques no link/Custo por
// conversa) vem do total da conta (DailyMetric, Etapa 4), separado das
// métricas por campanha (AdDailyMetric, Etapa 5) usadas em
// campanhas/segmentos/distribuição — por isso os testes de comparação
// semeiam os dois.
async function seedAccountDailyMetric(date: Date, spend: number, resultsConversations: number, clicksLink: number) {
  await prisma.dailyMetric.create({
    data: {
      date,
      spend,
      resultsConversations,
      reach: 500,
      impressions: 1000,
      frequency: 1.2,
      clicksTotal: clicksLink + 5,
      clicksLink,
      isDemo: true,
    },
  });
}

describe("getExecutiveReport — comparação semanal", () => {
  it("mostra aumento quando a semana atual investe mais que a anterior", async () => {
    await seedAccountDailyMetric(CURRENT_WEEK_MONDAY, 200, 10, 40);
    await seedAccountDailyMetric(PREVIOUS_WEEK_MONDAY, 100, 5, 20);
    await seedCampaignWithMetrics({
      externalId: "camp-cur",
      name: "Campanha Atual",
      segment: Segment.EDUCACAO_INFANTIL,
      date: CURRENT_WEEK_MONDAY,
      spend: 200,
      resultsConversations: 10,
      clicksLink: 40,
    });
    await seedCampaignWithMetrics({
      externalId: "camp-prev",
      name: "Campanha Anterior",
      segment: Segment.EDUCACAO_INFANTIL,
      date: PREVIOUS_WEEK_MONDAY,
      spend: 100,
      resultsConversations: 5,
      clicksLink: 20,
    });

    const report = await getExecutiveReport(CURRENT_WEEK_MONDAY);
    expect(report.comparison.currentComparable.spend).toBeGreaterThan(report.comparison.previousComparable.spend);
  });

  it("mostra redução quando a semana atual investe menos que a anterior", async () => {
    await seedAccountDailyMetric(CURRENT_WEEK_MONDAY, 50, 2, 10);
    await seedAccountDailyMetric(PREVIOUS_WEEK_MONDAY, 150, 8, 30);
    await seedCampaignWithMetrics({
      externalId: "camp-cur",
      name: "Campanha Atual",
      segment: null,
      date: CURRENT_WEEK_MONDAY,
      spend: 50,
      resultsConversations: 2,
      clicksLink: 10,
    });
    await seedCampaignWithMetrics({
      externalId: "camp-prev",
      name: "Campanha Anterior",
      segment: null,
      date: PREVIOUS_WEEK_MONDAY,
      spend: 150,
      resultsConversations: 8,
      clicksLink: 30,
    });

    const report = await getExecutiveReport(CURRENT_WEEK_MONDAY);
    expect(report.comparison.currentComparable.spend).toBeLessThan(report.comparison.previousComparable.spend);
  });

  it("não quebra quando não há período anterior (tudo zero, sem indisponível virando erro)", async () => {
    const report = await getExecutiveReport(CURRENT_WEEK_MONDAY);
    expect(report.comparison.currentComparable.spend).toBe(0);
    expect(report.comparison.previousComparable.spend).toBe(0);
    expect(report.campaigns).toEqual([]);
    expect(report.highlights.topSpend).toBeNull();
  });
});

describe("getExecutiveReport — distribuição, segmentos e destaques", () => {
  it("calcula percentual de distribuição do investimento e agrupa por segmento", async () => {
    await seedCampaignWithMetrics({
      externalId: "camp-a",
      name: "Campanha A",
      segment: Segment.EDUCACAO_INFANTIL,
      date: CURRENT_WEEK_MONDAY,
      spend: 300,
      resultsConversations: 15,
      clicksLink: 50,
    });
    await seedCampaignWithMetrics({
      externalId: "camp-b",
      name: "Campanha B",
      segment: Segment.ENSINO_MEDIO,
      date: CURRENT_WEEK_MONDAY,
      spend: 100,
      resultsConversations: 5,
      clicksLink: 20,
    });

    const report = await getExecutiveReport(CURRENT_WEEK_MONDAY);

    const distA = report.distribution.find((d) => d.campaignName === "Campanha A");
    expect(distA?.percent).toBeCloseTo(75, 1);

    expect(report.segments).toHaveLength(2);
    const seg = report.segments.find((s) => s.segment === "EDUCACAO_INFANTIL");
    expect(seg?.spend).toBe(300);

    expect(report.highlights.topSpend?.campaignName).toBe("Campanha A");
    expect(report.highlights.topConversations?.campaignName).toBe("Campanha A");
  });

  it("não gera distribuição/destaques quando não há investimento (tudo zero)", async () => {
    const report = await getExecutiveReport(CURRENT_WEEK_MONDAY);
    expect(report.distribution).toEqual([]);
    expect(report.segments).toEqual([]);
  });
});

describe("Relatório Executivo — conclusão", () => {
  it("upsertConclusion substitui o texto mantendo uma conclusão por semana", async () => {
    const admin = await prisma.user.create({
      data: {
        name: "Admin",
        email: `admin-${Date.now()}@evolucao.test`,
        passwordHash: await hashPassword("senha-valida-123"),
        role: UserRole.ADMIN,
      },
    });

    const { upsertConclusion, getConclusion } = await import("./conclusionService");

    await upsertConclusion(CURRENT_WEEK_MONDAY, "Primeira versão.", admin.id);
    await upsertConclusion(CURRENT_WEEK_MONDAY, "Versão revisada.", admin.id);

    const conclusion = await getConclusion(CURRENT_WEEK_MONDAY);
    expect(conclusion?.text).toBe("Versão revisada.");

    const all = await prisma.reportConclusion.findMany();
    expect(all).toHaveLength(1);
  });
});
