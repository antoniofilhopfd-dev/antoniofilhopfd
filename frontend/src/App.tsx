import { useState } from 'react'
import './App.css'
import './components/ui.css'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginForm } from './auth/LoginForm'
import { AppShell } from './layout/AppShell'
import { NAV_ITEMS } from './layout/navItems'
import { UnavailableState } from './components/states/UnavailableState'
import { DashboardScreen } from './dashboard/DashboardScreen'
import { CampaignsScreen } from './hierarchy/CampaignsScreen'
import { AdsScreen } from './hierarchy/AdsScreen'
import { AdministracaoScreen } from './admin/AdministracaoScreen'
import { ReportsScreen } from './reports/ReportsScreen'
import { DraftsScreen } from './drafts/DraftsScreen'

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

  function renderContent() {
    switch (activeKey) {
      case 'dashboard':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Dashboard</h1>
            <DashboardScreen />
          </>
        )
      case 'semanas':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Semanas</h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Histórico e comparação de semanas. Observações do gestor por semana entram na Etapa 8
              (Relatórios).
            </p>
            <DashboardScreen />
          </>
        )
      case 'campanhas':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Campanhas</h1>
            <CampaignsScreen />
          </>
        )
      case 'anuncios':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Anúncios</h1>
            <AdsScreen />
          </>
        )
      case 'meta-ads':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Meta Ads</h1>
            <DraftsScreen />
          </>
        )
      case 'relatorios':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Relatórios</h1>
            <ReportsScreen />
          </>
        )
      case 'administracao':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Administração</h1>
            <AdministracaoScreen />
          </>
        )
      default:
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>{activeItem?.label}</h1>
            <UnavailableState
              label={activeItem?.label ?? 'Esta área'}
              stage={activeItem?.availableFromStage}
            />
          </>
        )
    }
  }

  return (
    <AppShell activeKey={activeKey} onNavigate={setActiveKey}>
      {renderContent()}
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
