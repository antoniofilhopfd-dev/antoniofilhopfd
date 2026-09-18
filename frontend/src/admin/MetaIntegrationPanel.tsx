import { useEffect, useState } from 'react'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import type { MetaConnectionStatus } from './types'
import './admin.css'

const STATUS_LABEL: Record<string, string> = {
  not_configured: 'Não configurado',
  ok: 'Conectado',
  invalid_token: 'Token inválido',
  permission: 'Permissão insuficiente',
  rate_limit: 'Limite de requisições atingido',
  error: 'Erro',
  unknown: 'Erro desconhecido',
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR')
}

export function MetaIntegrationPanel() {
  const [status, setStatus] = useState<MetaConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [syncing, setSyncing] = useState(false)

  function load() {
    setLoading(true)
    setError(null)
    fetch('/integrations/meta/status', { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar status da integração.')
        return response.json()
      })
      .then((data: MetaConnectionStatus) => setStatus(data))
      .catch(() => setError('Não foi possível carregar o status da integração Meta.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleCheckConnection() {
    setChecking(true)
    setActionError(null)
    try {
      const response = await fetch('/integrations/meta/check-connection', {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'Falha ao verificar conexão.')
      }
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha ao verificar conexão.')
    } finally {
      setChecking(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setActionError(null)
    try {
      const response = await fetch('/integrations/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ daysBack: 30 }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error ?? 'Falha na sincronização.')
      }
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Falha na sincronização.')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <LoadingState label="Carregando status da integração…" />
  if (error) return <ErrorState description={error} onRetry={load} />
  if (!status) return null

  return (
    <div className="card admin-panel">
      <h2 style={{ marginBottom: 8 }}>Integração Meta</h2>

      {!status.configured && (
        <p className="admin-panel__pending">
          Configuração pendente — defina <code>META_ACCESS_TOKEN</code> e{' '}
          <code>META_AD_ACCOUNT_ID</code> no ambiente do servidor. Nenhuma conexão é simulada
          enquanto isso não for feito.
        </p>
      )}

      <dl className="admin-panel__status">
        <div>
          <dt>Status</dt>
          <dd className={`admin-status admin-status--${status.connectionStatus === 'ok' ? 'ok' : 'issue'}`}>
            {STATUS_LABEL[status.connectionStatus] ?? status.connectionStatus}
          </dd>
        </div>
        <div>
          <dt>Conta</dt>
          <dd>{status.accountName ?? status.accountId ?? 'indisponível'}</dd>
        </div>
        <div>
          <dt>Última verificação</dt>
          <dd>{formatDateTime(status.lastCheckedAt)}</dd>
        </div>
        <div>
          <dt>Última sincronização</dt>
          <dd>
            {formatDateTime(status.lastSyncAt)}
            {status.lastSyncStatus ? ` (${status.lastSyncStatus === 'success' ? 'sucesso' : 'falha'})` : ''}
          </dd>
        </div>
      </dl>

      {status.lastCheckedError && (
        <p className="reach-note">Último erro de verificação: {status.lastCheckedError}</p>
      )}
      {status.lastSyncError && <p className="reach-note">Último erro de sincronização: {status.lastSyncError}</p>}

      <div className="admin-panel__actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={handleCheckConnection}
          disabled={checking || !status.configured}
        >
          {checking ? 'Verificando…' : 'Verificar conexão'}
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={handleSync}
          disabled={syncing || !status.configured || status.isSyncing}
        >
          {syncing || status.isSyncing ? 'Sincronizando…' : 'Sincronizar últimos 30 dias'}
        </button>
      </div>

      {actionError && (
        <p className="form-error" role="alert" style={{ marginTop: 12 }}>
          {actionError}
        </p>
      )}

      <h3 style={{ margin: '20px 0 8px' }}>Histórico de sincronizações</h3>
      {status.recentLogs.length === 0 ? (
        <p className="reach-note">Nenhuma sincronização registrada ainda.</p>
      ) : (
        <table className="comparison-table">
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              <th scope="col">Início</th>
              <th scope="col">Status</th>
              <th scope="col" className="numeric">
                Itens processados
              </th>
            </tr>
          </thead>
          <tbody>
            {status.recentLogs.map((log) => (
              <tr key={log.id}>
                <td>{log.type === 'hierarchy' ? 'Hierarquia' : 'Métricas'}</td>
                <td>{formatDateTime(log.startedAt)}</td>
                <td className={log.status === 'success' ? 'comparison-delta--up' : 'comparison-delta--down'}>
                  {log.status === 'success' ? 'Sucesso' : 'Falha'}
                </td>
                <td className="numeric">{log.itemsProcessed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
