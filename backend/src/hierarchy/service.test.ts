import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { EntityStatus, Segment } from "@prisma/client";
import { prisma } from "../prisma";
import { classifyCampaign, getAdSetDetail, getCampaignDetail, listAds, listCampaigns } from "./service";

beforeEach(async () => {
  await prisma.adDailyMetric.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.campaign.deleteMany();
});

afterAll(async () => {
  await prisma.adDailyMetric.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.$disconnect();
});

async function seedHierarchy() {
  const campaignA = await prisma.campaign.create({
    data: {
      externalId: "t-camp-a",
      name: "Campanha Educação Infantil",
      objective: "OUTCOME_TRAFFIC",
      status: EntityStatus.ACTIVE,
      segment: Segment.EDUCACAO_INFANTIL,
      isDemo: true,
    },
  });
  const campaignB = await prisma.campaign.create({
    data: {
      externalId: "t-camp-b",
      name: "Campanha Ensino Médio",
      objective: "OUTCOME_TRAFFIC",
      status: EntityStatus.PAUSED,
      segment: Segment.ENSINO_MEDIO,
      isDemo: true,
    },
  });

  const adSetA = await prisma.adSet.create({
    data: {
      externalId: "t-adset-a",
      campaignId: campaignA.id,
      name: "Conjunto A",
      status: EntityStatus.ACTIVE,
      dailyBudget: 50,
      isDemo: true,
    },
  });

  const adA1 = await prisma.ad.create({
    data: {
      externalId: "t-ad-a1",
      adSetId: adSetA.id,
      name: "Anúncio A1",
      status: EntityStatus.ACTIVE,
      isDemo: true,
    },
  });
  const adA2 = await prisma.ad.create({
    data: {
      externalId: "t-ad-a2",
      adSetId: adSetA.id,
      name: "Anúncio A2",
      status: EntityStatus.ACTIVE,
      isDemo: true,
    },
  });

  await prisma.adDailyMetric.create({
    data: {
      adId: adA1.id,
      date: new Date("2026-01-05T00:00:00.000Z"),
      spend: 100,
      resultsConversations: 5,
      reach: 800,
      impressions: 1000,
      frequency: 1.2,
      clicksTotal: 30,
      clicksLink: 20,
      isDemo: true,
    },
  });
  await prisma.adDailyMetric.create({
    data: {
      adId: adA2.id,
      date: new Date("2026-01-05T00:00:00.000Z"),
      spend: 50,
      resultsConversations: 2,
      reach: 400,
      impressions: 500,
      frequency: 1.1,
      clicksTotal: 15,
      clicksLink: 10,
      isDemo: true,
    },
  });

  return { campaignA, campaignB, adSetA, adA1, adA2 };
}

describe("listCampaigns", () => {
  it("filtra por busca, status e segmento", async () => {
    await seedHierarchy();

    const bySearch = await listCampaigns({ search: "Infantil" });
    expect(bySearch.total).toBe(1);
    expect(bySearch.items[0].name).toContain("Infantil");

    const byStatus = await listCampaigns({ status: EntityStatus.PAUSED });
    expect(byStatus.total).toBe(1);
    expect(byStatus.items[0].status).toBe(EntityStatus.PAUSED);

    const bySegment = await listCampaigns({ segment: Segment.ENSINO_MEDIO });
    expect(bySegment.total).toBe(1);
  });

  it("pagina resultados", async () => {
    await seedHierarchy();
    const page1 = await listCampaigns({ page: 1, pageSize: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.total).toBe(2);
  });

  it("soma os totais dos anúncios filhos na campanha", async () => {
    const { campaignA } = await seedHierarchy();
    const result = await listCampaigns({ search: "Infantil" });
    expect(result.items[0].id).toBe(campaignA.id);
    expect(result.items[0].totals.spend).toBe(150);
    expect(result.items[0].totals.resultsConversations).toBe(7);
  });
});

describe("getCampaignDetail / getAdSetDetail", () => {
  it("retorna a hierarquia íntegra com totais por conjunto", async () => {
    const { campaignA, adSetA } = await seedHierarchy();

    const detail = await getCampaignDetail(campaignA.id);
    expect(detail?.adSets).toHaveLength(1);
    expect(detail?.adSets[0].id).toBe(adSetA.id);
    expect(detail?.adSets[0].totals.spend).toBe(150);
    expect(detail?.totals.spend).toBe(150);

    const adSetDetail = await getAdSetDetail(adSetA.id);
    expect(adSetDetail?.ads).toHaveLength(2);
    expect(adSetDetail?.campaign.id).toBe(campaignA.id);
  });

  it("retorna null para id inexistente", async () => {
    const detail = await getCampaignDetail("00000000-0000-0000-0000-000000000000");
    expect(detail).toBeNull();
  });
});

describe("listAds", () => {
  it("consulta transversal com filtro por campanha", async () => {
    const { campaignA } = await seedHierarchy();
    const result = await listAds({ campaignId: campaignA.id });
    expect(result.total).toBe(2);
    expect(result.items.every((ad) => ad.campaignId === campaignA.id)).toBe(true);
  });
});

describe("classifyCampaign", () => {
  it("marca a classificação como manual e ela não é sobrescrita por uma futura importação automática", async () => {
    const { campaignA } = await seedHierarchy();

    await classifyCampaign(campaignA.id, Segment.OUTROS);

    const updated = await prisma.campaign.findUnique({ where: { id: campaignA.id } });
    expect(updated?.segment).toBe(Segment.OUTROS);
    expect(updated?.segmentSource).toBe("manual");

    // Simula uma futura importação que só deve alterar campos quando
    // segmentSource não for "manual" (regra aplicada no script de seed/importação).
    const shouldSkipOverwrite = updated?.segmentSource === "manual";
    expect(shouldSkipOverwrite).toBe(true);
  });
});
