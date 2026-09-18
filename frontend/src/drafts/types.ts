export type CallToAction = 'SAIBA_MAIS' | 'CADASTRE_SE' | 'FALE_CONOSCO' | 'GARANTA_JA'

export const CTA_LABEL: Record<CallToAction, string> = {
  SAIBA_MAIS: 'Saiba mais',
  CADASTRE_SE: 'Cadastre-se',
  FALE_CONOSCO: 'Fale conosco',
  GARANTA_JA: 'Garanta já',
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
}

export type DraftValidation = {
  fieldErrors: Record<string, string>
  complete: boolean
}
