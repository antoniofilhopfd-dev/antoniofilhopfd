import { EmptyState } from '../components/states/EmptyState'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import { ComparisonTable } from './ComparisonTable'
import { DailyChart } from './DailyChart'
import { KpiGrid } from './KpiGrid'
import { WeekSelector } from './WeekSelector'
import { formatDatePtBr } from './format'
import { useWeekData } from './useWeekData'
import './dashboard.css'

export function DashboardScreen() {
  const { weeks, selectedWeekStart, comparison, loading, error, selectWeek } = useWeekData()

  if (weeks.length === 0 && !loading && !error) {
    return (
      <EmptyState
        title="Nenhum dado disponível ainda"
        description="Não há métricas diárias carregadas. Elas chegam da sincronização com o Meta (Etapa 6) ou de uma carga de demonstração."
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        <WeekSelector weeks={weeks} selected={selectedWeekStart} onChange={selectWeek} />
      </div>

      {error && <ErrorState description={error} />}

      {loading && !comparison && <LoadingState label="Carregando dados da semana…" />}

      {comparison && (
        <>
          {comparison.current.isDemo && (
            <div>
              <span className="demo-banner">
                Dados de demonstração — origem: dados fictícios, não Meta real
              </span>
            </div>
          )}

          <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Semana de {formatDatePtBr(comparison.current.weekStart)} a{' '}
            {formatDatePtBr(comparison.current.weekEnd)}
            {comparison.current.isPartial
              ? ` — parcial (${comparison.current.daysAvailable} de 7 dias com dado)`
              : ' — completa'}
            . Última atualização: dado de demonstração, sem sincronização real ainda.
          </p>

          <KpiGrid totals={comparison.current.totals} />

          <div className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ marginBottom: 12 }}>Investimento e resultados por dia</h2>
            <DailyChart daily={comparison.current.daily} />
            <p className="reach-note">{comparison.current.reachNote}</p>
          </div>

          <ComparisonTable comparison={comparison} />
        </>
      )}
    </div>
  )
}
