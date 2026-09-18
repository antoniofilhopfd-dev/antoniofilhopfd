export type DailyMetricRow = {
  date: string
  spend: number
  resultsConversations: number
  reach: number
  impressions: number
  frequency: number
  clicksTotal: number
  clicksLink: number
  isDemo: boolean
}

export type WeekTotals = {
  spend: number
  resultsConversations: number
  impressions: number
  clicksTotal: number
  clicksLink: number
  costPerResult: number | null
  ctr: number | null
  cpc: number | null
  cpm: number | null
}

export type WeekSummary = {
  weekStart: string
  weekEnd: string
  daysAvailable: number
  isPartial: boolean
  isDemo: boolean
  daily: DailyMetricRow[]
  totals: WeekTotals
  reachNote: string
}

export type WeekListItem = {
  weekStart: string
  weekEnd: string
  daysAvailable: number
  isPartial: boolean
}

export type WeekComparison = {
  current: WeekSummary
  previous: WeekSummary
  comparableDays: number
  comparisonNote: string | null
  currentComparable: WeekTotals
  previousComparable: WeekTotals
}
