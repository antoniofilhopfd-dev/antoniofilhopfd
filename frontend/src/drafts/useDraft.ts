import { useCallback, useEffect, useRef, useState } from 'react'
import type { Draft, DraftValidation } from './types'

export function useDraft(draftId: string) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [validation, setValidation] = useState<DraftValidation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Vários pontos disparam fetch/save de forma independente (blur de um
  // campo, upload de imagem). Sem sequenciar as respostas, uma resposta
  // mais lenta de uma requisição antiga pode chegar depois e sobrescrever
  // dados mais novos (condição de corrida observada ao testar upload de
  // imagem logo após editar um campo). Só aplicamos a resposta se ainda
  // for a requisição mais recente.
  const requestSeq = useRef(0);

  const load = useCallback(() => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/drafts/${draftId}`, { credentials: 'same-origin' }).then((r) => {
        if (!r.ok) throw new Error('Falha ao carregar rascunho.')
        return r.json()
      }),
      fetch(`/drafts/${draftId}/validation`, { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([draftData, validationData]) => {
        if (seq !== requestSeq.current) return
        setDraft(draftData)
        setValidation(validationData)
      })
      .catch(() => {
        if (seq === requestSeq.current) setError('Não foi possível carregar o rascunho.')
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false)
      })
  }, [draftId])

  useEffect(load, [load])

  async function save(patch: Record<string, unknown>) {
    const seq = ++requestSeq.current
    setSaving(true)
    try {
      const response = await fetch(`/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      })
      if (response.ok) {
        const updated: Draft = await response.json()
        if (seq !== requestSeq.current) return
        setDraft(updated)
        fetch(`/drafts/${draftId}/validation`, { credentials: 'same-origin' })
          .then((r) => (r.ok ? r.json() : null))
          .then((validationData) => {
            if (seq === requestSeq.current) setValidation(validationData)
          })
      }
    } finally {
      if (seq === requestSeq.current) setSaving(false)
    }
  }

  async function uploadImage(file: File) {
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const response = await fetch(`/drafts/${draftId}/image`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      })
      if (response.ok) {
        load()
        return null
      }
      const body = await response.json().catch(() => ({}))
      return body.error ?? 'Falha ao enviar imagem.'
    } finally {
      setSaving(false)
    }
  }

  async function removeImage() {
    setSaving(true)
    try {
      await fetch(`/drafts/${draftId}/image`, { method: 'DELETE', credentials: 'same-origin' })
      load()
    } finally {
      setSaving(false)
    }
  }

  async function submit(confirmations: {
    confirmAccount: boolean
    confirmAudience: boolean
    confirmBudget: boolean
    confirmCreative: boolean
  }) {
    setSaving(true)
    try {
      const response = await fetch(`/drafts/${draftId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(confirmations),
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok) {
        setDraft(body)
        return null
      }
      return body.error ?? 'Falha ao enviar à Meta.'
    } finally {
      setSaving(false)
    }
  }

  async function resolveAmbiguous(action: 'retry' | 'reset_confirmed_steps') {
    setSaving(true)
    try {
      const response = await fetch(`/drafts/${draftId}/submit/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok) {
        setDraft(body)
        return null
      }
      return body.error ?? 'Falha ao liberar rascunho.'
    } finally {
      setSaving(false)
    }
  }

  return { draft, validation, loading, error, saving, save, uploadImage, removeImage, submit, resolveAmbiguous, reload: load }
}
