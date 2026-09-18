import { useEffect, useState } from 'react'
import { EmptyState } from '../components/states/EmptyState'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import { formatDatePtBr } from '../dashboard/format'
import type { WeekListItem } from '../dashboard/types'

type HistoricoScreenProps = {
  onSelectWeek: (weekStart: string) => void
}

export function HistoricoScreen({ onSelectWeek }: HistoricoScreenProps) {
  const [weeks, setWeeks] = useState<WeekListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/metrics/weeks', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(setWeeks)
      .catch(() => setError('Não foi possível carregar o histórico de semanas.'))
  }, [])

  if (error) return <ErrorState description={error} />
  if (weeks === null) return <LoadingState label="Carregando histórico…" />
  if (weeks.length === 0) {
    return <EmptyState title="Nenhum período disponível" description="Ainda não há semanas com dados." />
  }

  return (
    <div className="card">
      <ul className="drafts-list">
        {weeks.map((week) => (
          <button
            key={week.weekStart}
            type="button"
            className="drafts-list__item"
            style={{ border: 'none', background: 'transparent', width: '100%' }}
            onClick={() => onSelectWeek(week.weekStart)}
          >
            <span className="drafts-list__title">
              {formatDatePtBr(week.weekStart)} – {formatDatePtBr(week.weekEnd)}
            </span>
            <span className="drafts-list__badge">{week.isPartial ? 'Parcial' : 'Completa'}</span>
          </button>
        ))}
      </ul>
    </div>
  )
}
