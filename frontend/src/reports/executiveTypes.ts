import type { Totals, WeekSummary } from '../dashboard/types'

export type ComparisonBlock = {
  current: WeekSummary
  previous: WeekSummary
  comparableDays: number
  comparisonNote: string | null
  currentComparable: Totals
  previousComparable: Totals
}

export type CampaignRow = {
  id: string
  name: string
  status: string
  segment: string | null
  spend: number
  cpcLink: number | null
  clicksLink: number
  resultsConversations: number
  costPerResult: number | null
}

export type SegmentRow = {
  segment: string
  spend: number
  resultsConversations: number
  clicksLink: number
  cpcLink: number | null
  costPerResult: number | null
}

export type DistributionRow = {
  campaignName: string
  spend: number
  percent: number
}

export type Highlights = {
  topSpend: { campaignName: string; spend: number } | null
  topConversations: { campaignName: string; resultsConversations: number } | null
  lowestCostPerResult: { campaignName: string; costPerResult: number } | null
}

export type ExecutiveObservation = {
  id: string
  text: string
  createdAt: string
  authorName: string
}

export type Conclusion = {
  text: string
  authorName?: string
  author?: { name: string }
  updatedAt: string
} | null

export type ExecutiveReportData = {
  week: WeekSummary
  comparison: ComparisonBlock
  campaigns: CampaignRow[]
  distribution: DistributionRow[]
  segments: SegmentRow[]
  reachAvailable: boolean
  observations: ExecutiveObservation[]
  conclusion: Conclusion
  highlights: Highlights
}

export const SEGMENT_LABEL: Record<string, string> = {
  EDUCACAO_INFANTIL: 'Educação Infantil',
  ANOS_INICIAIS: 'Anos Iniciais',
  ANOS_FINAIS: 'Anos Finais',
  ENSINO_MEDIO: 'Ensino Médio',
  INSTITUCIONAL: 'Institucional',
  OUTROS: 'Outros',
  SEM_CLASSIFICACAO: 'Sem classificação',
}
