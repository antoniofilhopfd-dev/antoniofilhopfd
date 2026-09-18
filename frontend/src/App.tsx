import { useEffect, useState } from 'react'
import './App.css'
import './components/ui.css'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { LoginForm } from './auth/LoginForm'
import { AppShell } from './layout/AppShell'
import { getDefaultTabForRole, getNavItemsForRole } from './layout/navItems'
import { UnavailableState } from './components/states/UnavailableState'
import { DashboardScreen } from './dashboard/DashboardScreen'
import { CampaignsScreen } from './hierarchy/CampaignsScreen'
import { AdsScreen } from './hierarchy/AdsScreen'
import { AdministracaoScreen } from './admin/AdministracaoScreen'
import { ReportsScreen } from './reports/ReportsScreen'
import { ExecutiveReportScreen } from './reports/ExecutiveReportScreen'
import { HistoricoScreen } from './reports/HistoricoScreen'
import { MinhaContaScreen } from './reports/MinhaContaScreen'
import { DraftsScreen } from './drafts/DraftsScreen'

function AppContent() {
  const { user, loading } = useAuth()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [reportWeekStart, setReportWeekStart] = useState<string | null>(null)

  useEffect(() => {
    if (user && activeKey === null) {
      setActiveKey(getDefaultTabForRole(user.role))
    }
  }, [user, activeKey])

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

  if (activeKey === null) {
    return null
  }

  const activeItem = getNavItemsForRole(user.role).find((item) => item.key === activeKey)

  function goToWeekReport(weekStart: string) {
    setReportWeekStart(weekStart)
    setActiveKey('relatorio-semana')
  }

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
      case 'relatorio-semana':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Relatório da Semana</h1>
            <ExecutiveReportScreen selectedWeekStart={reportWeekStart} onSelectWeek={setReportWeekStart} />
          </>
        )
      case 'historico':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Histórico</h1>
            <HistoricoScreen onSelectWeek={goToWeekReport} />
          </>
        )
      case 'conta':
        return (
          <>
            <h1 style={{ marginBottom: 16 }}>Minha Conta</h1>
            <MinhaContaScreen />
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
