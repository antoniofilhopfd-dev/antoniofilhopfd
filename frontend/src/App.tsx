import { useEffect, useState } from 'react'
import './App.css'
import './components/ui.css'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginForm } from './auth/LoginForm'
import { AppShell } from './layout/AppShell'
import { NAV_ITEMS } from './layout/navItems'
import { UnavailableState } from './components/states/UnavailableState'
import { ErrorState } from './components/states/ErrorState'

type HealthResponse = {
  status: 'ok' | 'error'
  api: 'up' | 'down'
  database: 'up' | 'down'
  timestamp: string
}

function DiagnosticoTemporario() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/health')
      .then((response) => response.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setError('Não foi possível contatar o backend.'))
  }, [])

  if (error) {
    return <ErrorState description={error} />
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h2 style={{ marginBottom: 12 }}>Diagnóstico técnico (temporário)</h2>
      <p style={{ marginBottom: 12, color: 'var(--color-text-muted)' }}>
        O Dashboard real (indicadores, gráfico diário, comparação de semanas) é implementado na
        Etapa 4. Este bloco confirma que API e banco estão no ar.
      </p>
      {health ? (
        <ul>
          <li>API: {health.api}</li>
          <li>Banco de dados: {health.database}</li>
          <li>Consultado em: {health.timestamp}</li>
        </ul>
      ) : (
        <p>Consultando…</p>
      )}
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  const [activeKey, setActiveKey] = useState('dashboard')

  if (loading) {
    return (
      <main style={{ display: 'flex', minHeight: '100svh', alignItems: 'center', justifyContent: 'center' }}>
        <p>Carregando…</p>
      </main>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  const activeItem = NAV_ITEMS.find((item) => item.key === activeKey)

  return (
    <AppShell activeKey={activeKey} onNavigate={setActiveKey}>
      {activeKey === 'dashboard' ? (
        <>
          <h1 style={{ marginBottom: 16 }}>Dashboard</h1>
          <DiagnosticoTemporario />
        </>
      ) : (
        <>
          <h1 style={{ marginBottom: 16 }}>{activeItem?.label}</h1>
          <UnavailableState
            label={activeItem?.label ?? 'Esta área'}
            stage={activeItem?.availableFromStage}
          />
        </>
      )}
    </AppShell>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
