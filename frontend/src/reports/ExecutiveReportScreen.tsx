import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { EmptyState } from '../components/states/EmptyState'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import { DailyChart } from '../dashboard/DailyChart'
import { formatCurrency, formatDatePtBr, formatNumber } from '../dashboard/format'
import type { WeekListItem } from '../dashboard/types'
import { WeekSelector } from '../dashboard/WeekSelector'
import type { ExecutiveReportData } from './executiveTypes'
import { SEGMENT_LABEL } from './executiveTypes'
import './executive-report.css'

function deltaLabel(current: number, previous: number): { text: string; className: string } {
  if (previous === 0) return { text: '—', className: '' }
  const delta = ((current - previous) / previous) * 100
  const sign = delta > 0 ? '+' : ''
  return {
    text: `${sign}${delta.toFixed(1)}%`,
    className: delta > 0 ? 'comparison-delta--up' : delta < 0 ? 'comparison-delta--down' : '',
  }
}

type ExecutiveReportScreenProps = {
  selectedWeekStart: string | null
  onSelectWeek: (weekStart: string) => void
}

export function ExecutiveReportScreen({ selectedWeekStart, onSelectWeek }: ExecutiveReportScreenProps) {
  const { user } = useAuth()
  const [weeks, setWeeks] = useState<WeekListItem[]>([])
  const [data, setData] = useState<ExecutiveReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conclusionDraft, setConclusionDraft] = useState('')
  const [savingConclusion, setSavingConclusion] = useState(false)

  const canWriteConclusion = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  useEffect(() => {
    fetch('/metrics/weeks', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((list: WeekListItem[]) => {
        setWeeks(list)
        if (!selectedWeekStart && list[0]) onSelectWeek(list[0].weekStart)
      })
      .catch(() => setError('Não foi possível carregar as semanas disponíveis.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedWeekStart) return
    setLoading(true)
    setError(null)
    fetch(`/reports/weeks/${selectedWeekStart}/executive`, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('Falha ao carregar relatório executivo.')
        return r.json()
      })
      .then((json: ExecutiveReportData) => {
        setData(json)
        setConclusionDraft(json.conclusion?.text ?? '')
      })
      .catch(() => setError('Não foi possível carregar o relatório executivo desta semana.'))
      .finally(() => setLoading(false))
  }, [selectedWeekStart])

  async function handleSaveConclusion() {
    if (!selectedWeekStart || conclusionDraft.trim().length === 0) return
    setSavingConclusion(true)
    try {
      const response = await fetch(`/reports/weeks/${selectedWeekStart}/conclusion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ text: conclusionDraft.trim() }),
      })
      if (response.ok) {
        const updated = await response.json()
        setData((prev) => (prev ? { ...prev, conclusion: updated } : prev))
      }
    } finally {
      setSavingConclusion(false)
    }
  }

  if (weeks.length === 0 && !loading && !error) {
    return (
      <EmptyState
        title="Nenhum dado disponível ainda"
        description="Não há métricas carregadas para gerar o relatório executivo."
      />
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <WeekSelector weeks={weeks} selected={selectedWeekStart} onChange={onSelectWeek} />
      </div>

      {error && <ErrorState description={error} />}
      {loading && <LoadingState label="Carregando relatório executivo…" />}

      {data && !loading && (
        <>
          {data.week.isDemo && <span className="demo-banner">Dados de demonstração — não é Meta real</span>}

          <p style={{ color: 'var(--color-text-muted)', margin: '12px 0 16px' }}>
            Semana de {formatDatePtBr(data.week.weekStart)} a {formatDatePtBr(data.week.weekEnd)}
            {data.week.isPartial ? ` — parcial (${data.week.daysAvailable} de 7 dias)` : ' — completa'}. Fonte:{' '}
            {data.week.isDemo ? 'demonstração' : 'Meta Ads'}.
          </p>

          <div className="reports-export card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a
                className="button button--primary"
                href={`/reports/weeks/${selectedWeekStart}/executive/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                Exportar PDF
              </a>
              <a className="button button--secondary" href={`/reports/weeks/${selectedWeekStart}/executive/xlsx`}>
                Exportar XLSX
              </a>
            </div>
          </div>

          <h2 style={{ margin: '0 0 12px' }}>Resumo da semana</h2>
          <div className="executive-kpi-grid">
            {[
              {
                label: 'Investimento',
                current: data.comparison.currentComparable.spend,
                previous: data.comparison.previousComparable.spend,
                fmt: formatCurrency,
              },
              {
                label: 'Conversas',
                current: data.comparison.currentComparable.resultsConversations,
                previous: data.comparison.previousComparable.resultsConversations,
                fmt: formatNumber,
              },
              {
                label: 'Custo por conversa',
                current: data.comparison.currentComparable.costPerResult,
                previous: data.comparison.previousComparable.costPerResult,
                fmt: formatCurrency,
              },
              {
                label: 'Cliques no link',
                current: data.comparison.currentComparable.clicksLink,
                previous: data.comparison.previousComparable.clicksLink,
                fmt: formatNumber,
              },
              {
                label: 'CPC de link',
                current: data.comparison.currentComparable.cpc,
                previous: data.comparison.previousComparable.cpc,
                fmt: formatCurrency,
              },
            ].map((item) => {
              const cur = item.current ?? 0
              const prev = item.previous ?? 0
              const delta = deltaLabel(cur, prev)
              return (
                <div key={item.label} className="card executive-kpi">
                  <p className="executive-kpi__label">{item.label}</p>
                  <p className="executive-kpi__value">{item.fmt(item.current)}</p>
                  <p className="executive-kpi__prev">
                    Anterior: {item.fmt(item.previous)}{' '}
                    <span className={delta.className}>{delta.text}</span>
                  </p>
                </div>
              )
            })}
            <div className="card executive-kpi">
              <p className="executive-kpi__label">Alcance</p>
              <p className="executive-kpi__value">
                {data.reachAvailable ? '—' : 'indisponível'}
              </p>
              <p className="executive-kpi__prev">não somado entre dias</p>
            </div>
          </div>

          {data.comparison.comparisonNote && <p className="reach-note">{data.comparison.comparisonNote}</p>}

          <div className="card" style={{ margin: '20px 0' }}>
            <h2 style={{ marginBottom: 12 }}>Investimento e conversas por dia</h2>
            <DailyChart daily={data.week.daily} />
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Campanhas</h2>
            {data.campaigns.length === 0 ? (
              <p className="reach-note">Nenhuma campanha no período.</p>
            ) : (
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th scope="col">Campanha</th>
                    <th scope="col">Segmento</th>
                    <th scope="col" className="numeric">Investimento</th>
                    <th scope="col" className="numeric">CPC link</th>
                    <th scope="col" className="numeric">Cliques link</th>
                    <th scope="col" className="numeric">Conversas</th>
                    <th scope="col" className="numeric">Custo/conversa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">{c.name}</th>
                      <td>{c.segment ? SEGMENT_LABEL[c.segment] ?? c.segment : 'Sem classificação'}</td>
                      <td className="numeric">{formatCurrency(c.spend)}</td>
                      <td className="numeric">{formatCurrency(c.cpcLink)}</td>
                      <td className="numeric">{formatNumber(c.clicksLink)}</td>
                      <td className="numeric">{formatNumber(c.resultsConversations)}</td>
                      <td className="numeric">{formatCurrency(c.costPerResult)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="reach-note" style={{ marginTop: 8 }}>
              Miniatura de criativo indisponível nesta etapa (imagens reais de anúncios sincronizados da Meta
              ainda não são armazenadas — só as de rascunhos, que são outra coisa).
            </p>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
            <div className="card" style={{ flex: 1, minWidth: 280 }}>
              <h2 style={{ marginBottom: 12 }}>Distribuição do investimento</h2>
              {data.distribution.length === 0 ? (
                <p className="reach-note">Sem investimento no período.</p>
              ) : (
                <ul className="executive-distribution-list">
                  {data.distribution.map((d) => (
                    <li key={d.campaignName}>
                      <span>{d.campaignName}</span>
                      <span>
                        {formatCurrency(d.spend)} · {d.percent.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card" style={{ flex: 1, minWidth: 280 }}>
              <h2 style={{ marginBottom: 12 }}>Desempenho por segmento</h2>
              {data.segments.length === 0 ? (
                <p className="reach-note">Sem dados de segmento no período.</p>
              ) : (
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th scope="col">Segmento</th>
                      <th scope="col" className="numeric">Investimento</th>
                      <th scope="col" className="numeric">Conversas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.segments.map((s) => (
                      <tr key={s.segment}>
                        <th scope="row">{SEGMENT_LABEL[s.segment] ?? s.segment}</th>
                        <td className="numeric">{formatCurrency(s.spend)}</td>
                        <td className="numeric">{formatNumber(s.resultsConversations)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Destaques da semana</h2>
            <ul className="executive-highlights-list">
              {data.highlights.topSpend && (
                <li>
                  <strong>Maior investimento:</strong> {data.highlights.topSpend.campaignName} —{' '}
                  {formatCurrency(data.highlights.topSpend.spend)}
                </li>
              )}
              {data.highlights.topConversations && (
                <li>
                  <strong>Maior número de conversas:</strong> {data.highlights.topConversations.campaignName} —{' '}
                  {formatNumber(data.highlights.topConversations.resultsConversations)}
                </li>
              )}
              {data.highlights.lowestCostPerResult && (
                <li>
                  <strong>Menor custo por conversa:</strong> {data.highlights.lowestCostPerResult.campaignName} —{' '}
                  {formatCurrency(data.highlights.lowestCostPerResult.costPerResult)}
                </li>
              )}
              {!data.highlights.topSpend && !data.highlights.topConversations && !data.highlights.lowestCostPerResult && (
                <li className="reach-note">Sem destaques calculáveis no período.</li>
              )}
            </ul>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Observações</h2>
            {data.observations.length === 0 ? (
              <p className="reach-note">Nenhuma observação registrada para esta semana.</p>
            ) : (
              <ul className="reports-observation-list">
                {data.observations.map((obs) => (
                  <li key={obs.id} className="reports-observation">
                    <div>
                      <p className="reports-observation__meta">
                        {obs.authorName} · {new Date(obs.createdAt).toLocaleString('pt-BR')}
                      </p>
                      <p>{obs.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Conclusão do responsável</h2>
            {canWriteConclusion ? (
              <div className="field">
                <label htmlFor="conclusion-text">Texto (visível ao perfil Relatório em modo leitura)</label>
                <textarea
                  id="conclusion-text"
                  rows={4}
                  value={conclusionDraft}
                  onChange={(e) => setConclusionDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="button button--primary"
                  style={{ marginTop: 8, alignSelf: 'flex-start' }}
                  onClick={handleSaveConclusion}
                  disabled={savingConclusion || conclusionDraft.trim().length === 0}
                >
                  {savingConclusion ? 'Salvando…' : 'Salvar conclusão'}
                </button>
                {data.conclusion && (
                  <p className="reach-note" style={{ marginTop: 8 }}>
                    Última edição: {data.conclusion.author?.name ?? data.conclusion.authorName} em{' '}
                    {new Date(data.conclusion.updatedAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            ) : data.conclusion ? (
              <div>
                <p>{data.conclusion.text}</p>
                <p className="reach-note" style={{ marginTop: 8 }}>
                  {data.conclusion.author?.name ?? data.conclusion.authorName} ·{' '}
                  {new Date(data.conclusion.updatedAt).toLocaleString('pt-BR')}
                </p>
              </div>
            ) : (
              <p className="reach-note">Conclusão ainda não registrada para esta semana.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
