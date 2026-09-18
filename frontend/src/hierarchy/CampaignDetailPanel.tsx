import { useEffect, useState } from 'react'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import { formatCurrency, formatNumber, formatPercent } from '../dashboard/format'
import type { CampaignDetail, Segment } from './types'
import { SEGMENT_LABEL, STATUS_LABEL } from './types'
import { useAuth } from '../auth/AuthContext'

type CampaignDetailPanelProps = {
  campaignId: string
}

export function CampaignDetailPanel({ campaignId }: CampaignDetailPanelProps) {
  const { user } = useAuth()
  const [detail, setDetail] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingSegment, setSavingSegment] = useState(false)

  const canClassify = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  function load() {
    setLoading(true)
    setError(null)
    fetch(`/campaigns/${campaignId}`, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar detalhe.')
        return response.json()
      })
      .then((data: CampaignDetail) => setDetail(data))
      .catch(() => setError('Não foi possível carregar o detalhe da campanha.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [campaignId])

  async function handleClassify(segment: Segment) {
    setSavingSegment(true)
    try {
      await fetch(`/campaigns/${campaignId}/classification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ segment }),
      })
      load()
    } finally {
      setSavingSegment(false)
    }
  }

  if (loading) return <LoadingState label="Carregando conjuntos…" />
  if (error) return <ErrorState description={error} onRetry={load} />
  if (!detail) return null

  return (
    <div className="hierarchy-detail">
      {canClassify && (
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor={`segment-${detail.id}`}>Classificação (segmento)</label>
          <select
            id={`segment-${detail.id}`}
            value={detail.segment ?? ''}
            disabled={savingSegment}
            onChange={(event) => handleClassify(event.target.value as Segment)}
          >
            <option value="" disabled>
              Selecionar…
            </option>
            {Object.entries(SEGMENT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {detail.segmentSource === 'manual' && (
            <p className="reach-note">Classificação manual — não será sobrescrita por importação.</p>
          )}
        </div>
      )}

      <table className="comparison-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th scope="col">Conjunto</th>
            <th scope="col">Status</th>
            <th scope="col" className="numeric">
              Orçamento diário
            </th>
            <th scope="col" className="numeric">
              Investimento
            </th>
            <th scope="col" className="numeric">
              Resultados
            </th>
            <th scope="col" className="numeric">
              CTR
            </th>
          </tr>
        </thead>
        <tbody>
          {detail.adSets.map((adSet) => (
            <tr key={adSet.id}>
              <th scope="row">
                {adSet.name} <span className="reach-note">({adSet.adCount} anúncio(s))</span>
              </th>
              <td>{STATUS_LABEL[adSet.status]}</td>
              <td className="numeric">{formatCurrency(adSet.dailyBudget)}</td>
              <td className="numeric">{formatCurrency(adSet.totals.spend)}</td>
              <td className="numeric">{formatNumber(adSet.totals.resultsConversations)}</td>
              <td className="numeric">{formatPercent(adSet.totals.ctr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
