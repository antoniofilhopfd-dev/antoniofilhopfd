import { useEffect, useState } from 'react'
import './App.css'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginForm } from './auth/LoginForm'

type HealthResponse = {
  status: 'ok' | 'error'
  api: 'up' | 'down'
  database: 'up' | 'down'
  timestamp: string
}

function Diagnostico() {
  const { user, logout } = useAuth()
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/health')
      .then((response) => response.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setError('Não foi possível contatar o backend.'))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Evolução Tráfego — Diagnóstico</h1>
      <p>
        Sessão de {user?.name} ({user?.role}).{' '}
        <button type="button" onClick={() => logout()}>
          Sair
        </button>
      </p>
      <p>Tela temporária das Etapas 1–2. O layout definitivo será implementado na Etapa 3.</p>
      {error && <p role="alert">{error}</p>}
      {health && (
        <ul>
          <li>API: {health.api}</li>
          <li>Banco de dados: {health.database}</li>
          <li>Status geral: {health.status}</li>
          <li>Consultado em: {health.timestamp}</li>
        </ul>
      )}
    </main>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
        <p>Carregando…</p>
      </main>
    )
  }

  return user ? <Diagnostico /> : <LoginForm />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
