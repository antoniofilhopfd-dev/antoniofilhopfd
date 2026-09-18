import { useEffect, useState } from 'react'
import { EmptyState } from '../components/states/EmptyState'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import { formatCurrency, formatNumber } from '../dashboard/format'
import type { CampaignListItem, PagedResult, EntityStatus, Segment } from './types'
import { SEGMENT_LABEL, STATUS_LABEL } from './types'
import { CampaignDetailPanel } from './CampaignDetailPanel'
import './hierarchy.css'

export function CampaignsScreen() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EntityStatus | ''>('')
  const [segment, setSegment] = useState<Segment | ''>('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedResult<CampaignListItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    if (segment) params.set('segment', segment)
    params.set('page', String(page))

    fetch(`/campaigns?${params.toString()}`, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar campanhas.')
        return response.json()
      })
      .then((data: PagedResult<CampaignListItem>) => setResult(data))
      .catch(() => setError('Não foi possível carregar as campanhas.'))
      .finally(() => setLoading(false))
  }, [search, status, segment, page])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div>
      <div className="hierarchy-filters">
        <div className="field">
          <label htmlFor="campaign-search">Buscar por nome</label>
          <input
            id="campaign-search"
            type="text"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            placeholder="Ex.: Matrículas 2027"
          />
        </div>
        <div className="field">
          <label htmlFor="campaign-status">Status</label>
          <select
            id="campaign-status"
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value as EntityStatus | '')
            }}
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="campaign-segment">Segmento</label>
          <select
            id="campaign-segment"
            value={segment}
            onChange={(event) => {
              setPage(1)
              setSegment(event.target.value as Segment | '')
            }}
          >
            <option value="">Todos</option>
            {Object.entries(SEGMENT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorState description={error} />}
      {loading && <LoadingState label="Carregando campanhas…" />}

      {!loading && result && result.items.length === 0 && (
        <EmptyState
          title="Nenhuma campanha encontrada"
          description="Ajuste a busca ou os filtros, ou aguarde a carga de dados."
        />
      )}

      {!loading && result && result.items.length > 0 && (
        <>
          <div className="hierarchy-list">
            {result.items.map((campaign) => (
              <div key={campaign.id} className="card hierarchy-item">
                <button
                  type="button"
                  className="hierarchy-item__header"
                  onClick={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)}
                  aria-expanded={expandedId === campaign.id}
                >
                  <div>
                    <p className="hierarchy-item__name">{campaign.name}</p>
                    <p className="hierarchy-item__meta">
                      {STATUS_LABEL[campaign.status]}
                      {campaign.segment ? ` · ${SEGMENT_LABEL[campaign.segment]}` : ' · Sem classificação'}
                      {' · '}
                      {campaign.adSetCount} conjunto(s)
                      {campaign.isDemo ? ' · demonstração' : ''}
                    </p>
                  </div>
                  <div className="hierarchy-item__totals">
                    <span>{formatCurrency(campaign.totals.spend)}</span>
                    <span>{formatNumber(campaign.totals.resultsConversations)} resultados</span>
                  </div>
                </button>
                {expandedId === campaign.id && <CampaignDetailPanel campaignId={campaign.id} />}
              </div>
            ))}
          </div>

          <div className="hierarchy-pagination">
            <button
              type="button"
              className="button button--secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages} ({result.total} campanhas)
            </span>
            <button
              type="button"
              className="button button--secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </div>
  )
}
