import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { EmptyState } from '../components/states/EmptyState'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import { DraftEditor } from './DraftEditor'
import type { Draft } from './types'
import './drafts.css'

export function DraftsScreen() {
  const { user } = useAuth()
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const canWrite = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  function load() {
    setError(null)
    fetch('/drafts', { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar rascunhos.')
        return response.json()
      })
      .then((data: Draft[]) => setDrafts(data))
      .catch(() => setError('Não foi possível carregar os rascunhos.'))
  }

  useEffect(load, [])

  async function handleCreate() {
    setCreating(true)
    try {
      const response = await fetch('/drafts', { method: 'POST', credentials: 'same-origin' })
      if (response.ok) {
        const draft: Draft = await response.json()
        load()
        setSelectedId(draft.id)
      }
    } finally {
      setCreating(false)
    }
  }

  if (selectedId) {
    return (
      <DraftEditor
        draftId={selectedId}
        onBack={() => {
          setSelectedId(null)
          load()
        }}
      />
    )
  }

  return (
    <div>
      {canWrite && (
        <button type="button" className="button button--primary" onClick={handleCreate} disabled={creating} style={{ marginBottom: 16 }}>
          {creating ? 'Criando…' : 'Novo rascunho'}
        </button>
      )}

      {error && <ErrorState description={error} />}
      {drafts === null && !error && <LoadingState label="Carregando rascunhos…" />}

      {drafts !== null && drafts.length === 0 && (
        <EmptyState
          title="Nenhum rascunho ainda"
          description={
            canWrite
              ? 'Crie um rascunho para preparar uma campanha de tráfego para site (imagem, um conjunto e um anúncio).'
              : 'Nenhum rascunho foi criado ainda.'
          }
        />
      )}

      {drafts !== null && drafts.length > 0 && (
        <div className="drafts-list">
          {drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              className="card drafts-list__item"
              onClick={() => setSelectedId(draft.id)}
            >
              <div>
                <p className="drafts-list__title">{draft.campaignName || 'Rascunho sem nome'}</p>
                <p className="drafts-list__meta">
                  Por {draft.createdBy.name} · atualizado em {new Date(draft.updatedAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <span className={`drafts-list__badge ${draft.hasImage ? 'drafts-list__badge--ok' : ''}`}>
                {draft.hasImage ? 'Com imagem' : 'Sem imagem'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
