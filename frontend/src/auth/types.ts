export type UserRole = 'ADMIN' | 'MANAGER' | 'VIEWER'

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: UserRole
  canSubmitToMeta: boolean
}
