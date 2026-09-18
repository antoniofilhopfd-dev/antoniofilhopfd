import type { UserRole } from '../auth/types'

export type NavItem = {
  key: string
  label: string
  /** Perfis que podem ver este item. Vazio = todos os perfis autenticados. */
  roles?: UserRole[]
  /** Etapa do planejamento em que a função é implementada; usado para explicar indisponibilidade. */
  availableFromStage?: number
}

// Menu administrativo (Administrador/Gestor) — inalterado desde as etapas
// anteriores, exceto por 'administracao' que já era restrito a ADMIN.
const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', availableFromStage: 4 },
  { key: 'semanas', label: 'Semanas', availableFromStage: 4 },
  { key: 'campanhas', label: 'Campanhas', availableFromStage: 5 },
  { key: 'anuncios', label: 'Anúncios', availableFromStage: 5 },
  { key: 'meta-ads', label: 'Meta Ads', availableFromStage: 9, roles: ['ADMIN', 'MANAGER'] },
  { key: 'relatorios', label: 'Relatórios', availableFromStage: 8 },
  {
    key: 'administracao',
    label: 'Administração',
    roles: ['ADMIN'],
    availableFromStage: 2,
  },
]

// Menu simplificado do perfil Relatório (VIEWER) — incremento "Área de
// Relatórios": entra direto no Relatório da Semana, sem a interface
// administrativa completa (Seção 3/4 do incremento).
const REPORT_NAV_ITEMS: NavItem[] = [
  { key: 'relatorio-semana', label: 'Relatório da Semana' },
  { key: 'historico', label: 'Histórico' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'conta', label: 'Minha Conta' },
]

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return role === 'VIEWER' ? REPORT_NAV_ITEMS : ADMIN_NAV_ITEMS
}

export function getDefaultTabForRole(role: UserRole): string {
  return role === 'VIEWER' ? 'relatorio-semana' : 'dashboard'
}

export function isNavItemVisible(item: NavItem, role: UserRole): boolean {
  if (!item.roles) return true
  return item.roles.includes(role)
}
