export type CallToAction = 'SAIBA_MAIS' | 'CADASTRE_SE' | 'FALE_CONOSCO' | 'GARANTA_JA'

export const CTA_LABEL: Record<CallToAction, string> = {
  SAIBA_MAIS: 'Saiba mais',
  CADASTRE_SE: 'Cadastre-se',
  FALE_CONOSCO: 'Fale conosco',
  GARANTA_JA: 'Garanta já',
}

export type DraftSubmissionStatus = 'NOT_SUBMITTED' | 'SUBMITTING' | 'SUBMITTED' | 'FAILED' | 'AMBIGUOUS_BLOCKED'

export const SUBMISSION_STATUS_LABEL: Record<DraftSubmissionStatus, string> = {
  NOT_SUBMITTED: 'Não enviado',
  SUBMITTING: 'Enviando…',
  SUBMITTED: 'Enviado (pausado) para a Meta',
  FAILED: 'Falha no envio anterior',
  AMBIGUOUS_BLOCKED: 'Bloqueado — resultado indeterminado, aguarda conferência administrativa',
}

export type Draft = {
  id: string
  createdBy: { id: string; name: string }
  campaignName: string | null
  adSetName: string | null
  dailyBudget: number | null
  country: string | null
  ageMin: number | null
  ageMax: number | null
  adName: string | null
  facebookPageName: string | null
  title: string | null
  bodyText: string | null
  destinationUrl: string | null
  callToAction: CallToAction | null
  hasImage: boolean
  imageOriginalName: string | null
  createdAt: string
  updatedAt: string
  submissionStatus: DraftSubmissionStatus
  submittedCampaignExternalId: string | null
  submittedAdSetExternalId: string | null
  submittedCreativeExternalId: string | null
  submittedAdExternalId: string | null
  submittedAt: string | null
  submittedById: string | null
  lastSubmissionError: string | null
}

export type DraftValidation = {
  fieldErrors: Record<string, string>
  complete: boolean
}
