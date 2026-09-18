import { useAuth } from '../auth/AuthContext'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  VIEWER: 'Relatório',
}

export function MinhaContaScreen() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <div className="card" style={{ maxWidth: 400 }}>
      <p style={{ marginBottom: 8 }}>
        <strong>Nome:</strong> {user.name}
      </p>
      <p style={{ marginBottom: 8 }}>
        <strong>E-mail:</strong> {user.email}
      </p>
      <p style={{ marginBottom: 16 }}>
        <strong>Perfil:</strong> {ROLE_LABEL[user.role]}
      </p>
      <button type="button" className="button button--secondary" onClick={() => logout()}>
        Sair
      </button>
    </div>
  )
}
