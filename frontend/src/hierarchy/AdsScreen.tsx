import { useEffect, useState } from 'react'
import { EmptyState } from '../components/states/EmptyState'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import { formatCurrency, formatNumber, formatPercent } from '../dashboard/format'
import type { AdListItem, EntityStatus, PagedResult } from './types'
import { STATUS_LABEL } from './types'
import './hierarchy.css'

export function AdsScreen() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<EntityStatus | ''>('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PagedResult<AdListItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    params.set('page', String(page))

    fetch(`/ads?${params.toString()}`, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar anúncios.')
        return response.json()
      })
      .then((data: PagedResult<AdListItem>) => setResult(data))
      .catch(() => setError('Não foi possível carregar os anúncios.'))
      .finally(() => setLoading(false))
  }, [search, status, page])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div>
      <div className="hierarchy-filters">
        <div className="field">
          <label htmlFor="ad-search">Buscar por nome</label>
          <input
            id="ad-search"
            type="text"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            placeholder="Ex.: Carrossel"
          />
        </div>
        <div className="field">
          <label htmlFor="ad-status">Status</label>
          <select
            id="ad-status"
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
      </div>

      {error && <ErrorState description={error} />}
      {loading && <LoadingState label="Carregando anúncios…" />}

      {!loading && result && result.items.length === 0 && (
        <EmptyState title="Nenhum anúncio encontrado" description="Ajuste a busca ou os filtros." />
      )}

      {!loading && result && result.items.length > 0 && (
        <>
          <div className="card">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th scope="col">Anúncio</th>
                  <th scope="col">Campanha / Conjunto</th>
                  <th scope="col">Status</th>
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
                {result.items.map((ad) => (
                  <tr key={ad.id}>
                    <th scope="row">
                      {ad.name}
                      {ad.isDemo ? <span className="reach-note"> (demonstração)</span> : null}
                    </th>
                    <td>
                      {ad.campaignName} / {ad.adSetName}
                    </td>
                    <td>{STATUS_LABEL[ad.status]}</td>
                    <td className="numeric">{formatCurrency(ad.totals.spend)}</td>
                    <td className="numeric">{formatNumber(ad.totals.resultsConversations)}</td>
                    <td className="numeric">{formatPercent(ad.totals.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              Página {page} de {totalPages} ({result.total} anúncios)
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
