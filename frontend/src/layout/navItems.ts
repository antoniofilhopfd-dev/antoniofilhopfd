import type { UserRole } from '../auth/types'

export type NavItem = {
  key: string
  label: string
  /** Perfis que podem ver este item. Vazio = todos os perfis autenticados. */
  roles?: UserRole[]
  /** Etapa do planejamento em que a função é implementada; usado para explicar indisponibilidade. */
  availableFromStage?: number
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', availableFromStage: 4 },
  { key: 'semanas', label: 'Semanas', availableFromStage: 4 },
  { key: 'campanhas', label: 'Campanhas', availableFromStage: 5 },
  { key: 'anuncios', label: 'Anúncios', availableFromStage: 5 },
  { key: 'meta-ads', label: 'Meta Ads', availableFromStage: 9 },
  { key: 'relatorios', label: 'Relatórios', availableFromStage: 8 },
  {
    key: 'administracao',
    label: 'Administração',
    roles: ['ADMIN'],
    availableFromStage: 2,
  },
]

export function isNavItemVisible(item: NavItem, role: UserRole): boolean {
  if (!item.roles) return true
  return item.roles.includes(role)
}
