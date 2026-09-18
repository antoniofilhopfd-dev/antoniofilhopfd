import { compareWeeks } from "../metrics/service";
import { getFullHierarchy } from "../hierarchy/service";
import { listObservations } from "../observations/service";
import { getConclusion } from "./conclusionService";
import { getWeekStart } from "../metrics/weeks";

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  segment: string | null;
  spend: number;
  cpcLink: number | null;
  clicksLink: number;
  resultsConversations: number;
  costPerResult: number | null;
};

export type SegmentRow = {
  segment: string;
  spend: number;
  resultsConversations: number;
  clicksLink: number;
  cpcLink: number | null;
  costPerResult: number | null;
};

export type DistributionRow = {
  campaignName: string;
  spend: number;
  percent: number;
};

export type Highlights = {
  topSpend: { campaignName: string; spend: number } | null;
  topConversations: { campaignName: string; resultsConversations: number } | null;
  lowestCostPerResult: { campaignName: string; costPerResult: number } | null;
};

export async function getExecutiveReport(weekStartInput: Date) {
  const weekStart = getWeekStart(weekStartInput);

  const [comparison, hierarchy, observations, conclusion] = await Promise.all([
    compareWeeks(weekStart, getWeekStart(new Date(weekStart.getTime() - 7 * 86400000))),
    getFullHierarchy(weekStart.toISOString().slice(0, 10)),
    listObservations(weekStart),
    getConclusion(weekStart),
  ]);

  const campaigns: CampaignRow[] = hierarchy.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    segment: c.segment,
    spend: c.totals.spend,
    cpcLink: c.totals.cpc,
    clicksLink: c.totals.clicksLink,
    resultsConversations: c.totals.resultsConversations,
    costPerResult: c.totals.costPerResult,
  }));

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);

  const distribution: DistributionRow[] = campaigns
    .filter((c) => c.spend > 0)
    .map((c) => ({
      campaignName: c.name,
      spend: c.spend,
      percent: totalSpend > 0 ? (c.spend / totalSpend) * 100 : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  const segmentMap = new Map<string, { spend: number; resultsConversations: number; clicksLink: number }>();
  for (const c of campaigns) {
    const key = c.segment ?? "SEM_CLASSIFICACAO";
    const current = segmentMap.get(key) ?? { spend: 0, resultsConversations: 0, clicksLink: 0 };
    current.spend += c.spend;
    current.resultsConversations += c.resultsConversations;
    current.clicksLink += c.clicksLink;
    segmentMap.set(key, current);
  }
  const segments: SegmentRow[] = Array.from(segmentMap.entries())
    .filter(([, v]) => v.spend > 0 || v.resultsConversations > 0 || v.clicksLink > 0)
    .map(([segment, v]) => ({
      segment,
      spend: v.spend,
      resultsConversations: v.resultsConversations,
      clicksLink: v.clicksLink,
      cpcLink: v.clicksLink > 0 ? v.spend / v.clicksLink : null,
      costPerResult: v.resultsConversations > 0 ? v.spend / v.resultsConversations : null,
    }))
    .sort((a, b) => b.spend - a.spend);

  const withSpend = campaigns.filter((c) => c.spend > 0);
  const withConversations = campaigns.filter((c) => c.resultsConversations > 0 && c.costPerResult !== null);

  const highlights: {
    topSpend: CampaignRow | null;
    topConversations: CampaignRow | null;
    lowestCostPerResult: CampaignRow | null;
  } = {
    topSpend:
      withSpend.length > 0
        ? withSpend.reduce((max, c) => (c.spend > max.spend ? c : max))
        : null,
    topConversations:
      campaigns.some((c) => c.resultsConversations > 0)
        ? campaigns.reduce((max, c) => (c.resultsConversations > max.resultsConversations ? c : max))
        : null,
    lowestCostPerResult:
      withConversations.length > 0
        ? withConversations.reduce((min, c) => (c.costPerResult! < min.costPerResult! ? c : min))
        : null,
  };

  return {
    comparison,
    campaigns,
    distribution,
    segments,
    // Alcance semanal agregado não é somado a partir dos dias (Seção 9/32
    // desta especificação) — não há, nesta etapa, um agregado único
    // validado no nível da semana para exibir; fica indisponível até a
    // API do Meta fornecer um agregado próprio (Etapa 6/7).
    reachAvailable: false,
    observations: observations.map((o) => ({
      id: o.id,
      text: o.text,
      createdAt: o.createdAt,
      authorName: o.author.name,
    })),
    conclusion: conclusion
      ? { text: conclusion.text, authorName: conclusion.author.name, updatedAt: conclusion.updatedAt }
      : null,
    highlights: {
      topSpend: highlights.topSpend
        ? { campaignName: highlights.topSpend.name, spend: highlights.topSpend.spend }
        : null,
      topConversations: highlights.topConversations
        ? {
            campaignName: highlights.topConversations.name,
            resultsConversations: highlights.topConversations.resultsConversations,
          }
        : null,
      lowestCostPerResult: highlights.lowestCostPerResult
        ? {
            campaignName: highlights.lowestCostPerResult.name,
            costPerResult: highlights.lowestCostPerResult.costPerResult!,
          }
        : null,
    },
  };
}

export type ExecutiveReport = Awaited<ReturnType<typeof getExecutiveReport>>;
