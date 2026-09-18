import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import { WeekSelector } from '../dashboard/WeekSelector'
import type { WeekListItem } from '../dashboard/types'
import { ExecutiveReportScreen } from './ExecutiveReportScreen'
import type { Observation } from './types'
import './reports.css'

type Tab = 'basico' | 'executivo'

export function ReportsScreen() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('basico')
  const [weeks, setWeeks] = useState<WeekListItem[]>([])
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newText, setNewText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canWrite = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  useEffect(() => {
    fetch('/metrics/weeks', { credentials: 'same-origin' })
      .then((response) => response.json())
      .then((data: WeekListItem[]) => {
        setWeeks(data)
        setSelectedWeekStart(data[0]?.weekStart ?? null)
      })
      .catch(() => setError('Não foi possível carregar as semanas disponíveis.'))
  }, [])

  function loadObservations(weekStart: string) {
    setLoading(true)
    setError(null)
    fetch(`/observations?weekStart=${weekStart}`, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar observações.')
        return response.json()
      })
      .then((data: Observation[]) => setObservations(data))
      .catch(() => setError('Não foi possível carregar as observações desta semana.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (selectedWeekStart) loadObservations(selectedWeekStart)
  }, [selectedWeekStart])

  async function handleSubmit() {
    if (!selectedWeekStart || newText.trim().length === 0) return
    setSubmitting(true)
    try {
      const response = await fetch('/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ weekStart: selectedWeekStart, text: newText.trim() }),
      })
      if (response.ok) {
        setNewText('')
        loadObservations(selectedWeekStart)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!selectedWeekStart) return
    await fetch(`/observations/${id}`, { method: 'DELETE', credentials: 'same-origin' })
    loadObservations(selectedWeekStart)
  }

  return (
    <div>
      <div className="draft-tabs" role="tablist" style={{ marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'basico'}
          className={`draft-tabs__tab ${tab === 'basico' ? 'draft-tabs__tab--active' : ''}`}
          onClick={() => setTab('basico')}
        >
          Relatório básico
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'executivo'}
          className={`draft-tabs__tab ${tab === 'executivo' ? 'draft-tabs__tab--active' : ''}`}
          onClick={() => setTab('executivo')}
        >
          Relatório Executivo
        </button>
      </div>

      {tab === 'executivo' ? (
        <ExecutiveReportScreen selectedWeekStart={selectedWeekStart} onSelectWeek={setSelectedWeekStart} />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <WeekSelector weeks={weeks} selected={selectedWeekStart} onChange={setSelectedWeekStart} />
          </div>

          {selectedWeekStart && (
            <div className="reports-export card" style={{ marginBottom: 20 }}>
              <h2 style={{ marginBottom: 8 }}>Exportar</h2>
              <p className="reach-note" style={{ marginBottom: 12 }}>
                Os arquivos exportam a semana selecionada acima (mesmo período mostrado na tela).
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <a
                  className="button button--primary"
                  href={`/reports/weeks/${selectedWeekStart}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Baixar PDF
                </a>
                <a className="button button--secondary" href={`/reports/weeks/${selectedWeekStart}/csv`}>
                  Baixar CSV
                </a>
              </div>
            </div>
          )}

          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Observações da semana</h2>

            {error && <ErrorState description={error} />}
            {loading && <LoadingState label="Carregando observações…" />}

            {!loading && observations.length === 0 && (
              <p className="reach-note" style={{ marginBottom: 16 }}>
                Nenhuma observação registrada para esta semana.
              </p>
            )}

            {!loading && observations.length > 0 && (
              <ul className="reports-observation-list">
                {observations.map((obs) => (
                  <li key={obs.id} className="reports-observation">
                    <div>
                      <p className="reports-observation__meta">
                        {obs.author.name} · {new Date(obs.createdAt).toLocaleString('pt-BR')}
                      </p>
                      <p>{obs.text}</p>
                    </div>
                    {(user?.id === obs.author.id || user?.role === 'ADMIN') && (
                      <button type="button" className="button button--secondary" onClick={() => handleDelete(obs.id)}>
                        Remover
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canWrite ? (
              <div className="field" style={{ marginTop: 16 }}>
                <label htmlFor="new-observation">Nova observação</label>
                <textarea
                  id="new-observation"
                  value={newText}
                  onChange={(event) => setNewText(event.target.value)}
                  rows={3}
                />
                <button
                  type="button"
                  className="button button--primary"
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                  onClick={handleSubmit}
                  disabled={submitting || newText.trim().length === 0}
                >
                  {submitting ? 'Salvando…' : 'Adicionar observação'}
                </button>
              </div>
            ) : (
              <p className="reach-note" style={{ marginTop: 16 }}>
                Seu perfil (Relatório) não pode adicionar observações.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
