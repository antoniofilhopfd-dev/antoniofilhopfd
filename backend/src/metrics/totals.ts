export type MetricRow = {
  spend: number;
  resultsConversations: number;
  impressions: number;
  clicksTotal: number;
  clicksLink: number;
};

export type Totals = {
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

export function computeTotals(rows: MetricRow[]): Totals {
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
