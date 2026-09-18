import { EntityStatus, Prisma, Segment } from "@prisma/client";
import { prisma } from "../prisma";
import { computeTotals, type Totals } from "../metrics/totals";
import { getWeekEnd, getWeekStart } from "../metrics/weeks";

export type Pagination = {
  page: number;
  pageSize: number;
};

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type PeriodRange = { start: Date; end: Date };

function resolvePeriod(weekStartInput?: string): PeriodRange | null {
  if (!weekStartInput) return null;
  const parsed = new Date(`${weekStartInput}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const start = getWeekStart(parsed);
  const end = getWeekEnd(start);
  return { start, end };
}

async function totalsForAdIds(adIds: string[], period: PeriodRange | null): Promise<Totals> {
  if (adIds.length === 0) {
    return computeTotals([]);
  }

  const rows = await prisma.adDailyMetric.findMany({
    where: {
      adId: { in: adIds },
      ...(period ? { date: { gte: period.start, lte: period.end } } : {}),
    },
  });

  return computeTotals(
    rows.map((r) => ({
      spend: Number(r.spend),
      resultsConversations: r.resultsConversations,
      impressions: r.impressions,
      clicksTotal: r.clicksTotal,
      clicksLink: r.clicksLink,
    }))
  );
}

export type CampaignListItem = {
  id: string;
  externalId: string;
  name: string;
  status: EntityStatus;
  objective: string;
  segment: Segment | null;
  segmentSource: string | null;
  isDemo: boolean;
  adSetCount: number;
  totals: Totals;
};

export async function listCampaigns(params: {
  search?: string;
  status?: EntityStatus;
  segment?: Segment;
  weekStart?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedResult<CampaignListItem>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const period = resolvePeriod(params.weekStart);

  const where: Prisma.CampaignWhereInput = {
    ...(params.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.segment ? { segment: params.segment } : {}),
  };

  const [total, campaigns] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { adSets: { include: { ads: { select: { id: true } } } } },
    }),
  ]);

  const items = await Promise.all(
    campaigns.map(async (campaign) => {
      const adIds = campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.id));
      const totals = await totalsForAdIds(adIds, period);
      return {
        id: campaign.id,
        externalId: campaign.externalId,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        segment: campaign.segment,
        segmentSource: campaign.segmentSource,
        isDemo: campaign.isDemo,
        adSetCount: campaign.adSets.length,
        totals,
      };
    })
  );

  return { items, page, pageSize, total };
}

export async function getCampaignDetail(id: string, weekStart?: string) {
  const period = resolvePeriod(weekStart);

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { adSets: { include: { ads: { select: { id: true } } }, orderBy: { name: "asc" } } },
  });

  if (!campaign) return null;

  const adSets = await Promise.all(
    campaign.adSets.map(async (adSet) => {
      const adIds = adSet.ads.map((ad) => ad.id);
      const totals = await totalsForAdIds(adIds, period);
      return {
        id: adSet.id,
        externalId: adSet.externalId,
        name: adSet.name,
        status: adSet.status,
        dailyBudget: Number(adSet.dailyBudget),
        isDemo: adSet.isDemo,
        adCount: adSet.ads.length,
        totals,
      };
    })
  );

  const allAdIds = campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.id));
  const totals = await totalsForAdIds(allAdIds, period);

  return {
    id: campaign.id,
    externalId: campaign.externalId,
    name: campaign.name,
    status: campaign.status,
    objective: campaign.objective,
    segment: campaign.segment,
    segmentSource: campaign.segmentSource,
    isDemo: campaign.isDemo,
    totals,
    adSets,
  };
}

export async function getAdSetDetail(id: string, weekStart?: string) {
  const period = resolvePeriod(weekStart);

  const adSet = await prisma.adSet.findUnique({
    where: { id },
    include: { campaign: true, ads: { orderBy: { name: "asc" } } },
  });

  if (!adSet) return null;

  const ads = await Promise.all(
    adSet.ads.map(async (ad) => {
      const totals = await totalsForAdIds([ad.id], period);
      return {
        id: ad.id,
        externalId: ad.externalId,
        name: ad.name,
        status: ad.status,
        isDemo: ad.isDemo,
        totals,
      };
    })
  );

  const totals = await totalsForAdIds(adSet.ads.map((ad) => ad.id), period);

  return {
    id: adSet.id,
    externalId: adSet.externalId,
    name: adSet.name,
    status: adSet.status,
    dailyBudget: Number(adSet.dailyBudget),
    isDemo: adSet.isDemo,
    campaign: { id: adSet.campaign.id, name: adSet.campaign.name },
    totals,
    ads,
  };
}

export type AdListItem = {
  id: string;
  externalId: string;
  name: string;
  status: EntityStatus;
  isDemo: boolean;
  campaignId: string;
  campaignName: string;
  adSetId: string;
  adSetName: string;
  totals: Totals;
};

export async function listAds(params: {
  search?: string;
  status?: EntityStatus;
  campaignId?: string;
  weekStart?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedResult<AdListItem>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 20));
  const period = resolvePeriod(params.weekStart);

  const where: Prisma.AdWhereInput = {
    ...(params.search ? { name: { contains: params.search, mode: "insensitive" } } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.campaignId ? { adSet: { campaignId: params.campaignId } } : {}),
  };

  const [total, ads] = await Promise.all([
    prisma.ad.count({ where }),
    prisma.ad.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { adSet: { include: { campaign: true } } },
    }),
  ]);

  const items = await Promise.all(
    ads.map(async (ad) => {
      const totals = await totalsForAdIds([ad.id], period);
      return {
        id: ad.id,
        externalId: ad.externalId,
        name: ad.name,
        status: ad.status,
        isDemo: ad.isDemo,
        campaignId: ad.adSet.campaign.id,
        campaignName: ad.adSet.campaign.name,
        adSetId: ad.adSet.id,
        adSetName: ad.adSet.name,
        totals,
      };
    })
  );

  return { items, page, pageSize, total };
}

// Árvore completa (campanha -> conjunto -> anúncio) com totais por nível,
// para uso no relatório PDF/CSV (Etapa 8) — evita N+1 de chamadas de
// detalhe por campanha/conjunto.
export async function getFullHierarchy(weekStart?: string) {
  const period = resolvePeriod(weekStart);

  const campaigns = await prisma.campaign.findMany({
    orderBy: { name: "asc" },
    include: {
      adSets: {
        orderBy: { name: "asc" },
        include: { ads: { orderBy: { name: "asc" } } },
      },
    },
  });

  return Promise.all(
    campaigns.map(async (campaign) => {
      const adSets = await Promise.all(
        campaign.adSets.map(async (adSet) => {
          const ads = await Promise.all(
            adSet.ads.map(async (ad) => ({
              id: ad.id,
              name: ad.name,
              status: ad.status,
              totals: await totalsForAdIds([ad.id], period),
            }))
          );
          const adSetTotals = await totalsForAdIds(adSet.ads.map((a) => a.id), period);
          return {
            id: adSet.id,
            name: adSet.name,
            status: adSet.status,
            totals: adSetTotals,
            ads,
          };
        })
      );
      const campaignTotals = await totalsForAdIds(
        campaign.adSets.flatMap((s) => s.ads.map((a) => a.id)),
        period
      );
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        segment: campaign.segment,
        totals: campaignTotals,
        adSets,
      };
    })
  );
}

export async function classifyCampaign(id: string, segment: Segment) {
  return prisma.campaign.update({
    where: { id },
    data: { segment, segmentSource: "manual" },
  });
}
