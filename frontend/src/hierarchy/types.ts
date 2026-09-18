export type EntityStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

export type Segment =
  | 'EDUCACAO_INFANTIL'
  | 'ANOS_INICIAIS'
  | 'ANOS_FINAIS'
  | 'ENSINO_MEDIO'
  | 'INSTITUCIONAL'
  | 'OUTROS'

export const SEGMENT_LABEL: Record<Segment, string> = {
  EDUCACAO_INFANTIL: 'Educação Infantil',
  ANOS_INICIAIS: 'Anos Iniciais',
  ANOS_FINAIS: 'Anos Finais',
  ENSINO_MEDIO: 'Ensino Médio',
  INSTITUCIONAL: 'Institucional',
  OUTROS: 'Outros',
}

export const STATUS_LABEL: Record<EntityStatus, string> = {
  ACTIVE: 'Ativo',
  PAUSED: 'Pausado',
  ARCHIVED: 'Arquivado',
}

export type Totals = {
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

export type CampaignListItem = {
  id: string
  externalId: string
  name: string
  status: EntityStatus
  objective: string
  segment: Segment | null
  segmentSource: string | null
  isDemo: boolean
  adSetCount: number
  totals: Totals
}

export type PagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export type AdSetSummary = {
  id: string
  externalId: string
  name: string
  status: EntityStatus
  dailyBudget: number
  isDemo: boolean
  adCount: number
  totals: Totals
}

export type CampaignDetail = {
  id: string
  externalId: string
  name: string
  status: EntityStatus
  objective: string
  segment: Segment | null
  segmentSource: string | null
  isDemo: boolean
  totals: Totals
  adSets: AdSetSummary[]
}

export type AdListItem = {
  id: string
  externalId: string
  name: string
  status: EntityStatus
  isDemo: boolean
  campaignId: string
  campaignName: string
  adSetId: string
  adSetName: string
  totals: Totals
}
