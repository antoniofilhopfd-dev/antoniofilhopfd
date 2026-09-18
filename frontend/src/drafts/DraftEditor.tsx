import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from '../components/states/ErrorState'
import { LoadingState } from '../components/states/LoadingState'
import { AdPreview } from './AdPreview'
import { CTA_LABEL } from './types'
import type { CallToAction } from './types'
import { useDraft } from './useDraft'
import './drafts.css'

type Tab = 'campanha' | 'conjunto' | 'anuncio' | 'revisao'

const TABS: { key: Tab; label: string }[] = [
  { key: 'campanha', label: 'Campanha' },
  { key: 'conjunto', label: 'Conjunto' },
  { key: 'anuncio', label: 'Anúncio' },
  { key: 'revisao', label: 'Revisão' },
]

type DraftEditorProps = {
  draftId: string
  onBack: () => void
}

export function DraftEditor({ draftId, onBack }: DraftEditorProps) {
  const { user } = useAuth()
  const { draft, validation, loading, error, save, uploadImage, removeImage } = useDraft(draftId)
  const [tab, setTab] = useState<Tab>('campanha')
  const [imageError, setImageError] = useState<string | null>(null)
  const [local, setLocal] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Sincroniza o estado local a partir do servidor só na primeira carga
  // deste rascunho. Sem isso, salvar um campo (via onBlur) reescreve
  // `draft` inteiro e o efeito reseta TODOS os campos locais a partir da
  // resposta do servidor — apagando edições ainda não salvas (ainda sem
  // blur) de outros campos preenchidos na mesma interação.
  const initializedDraftId = useRef<string | null>(null)

  const canWrite = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const imageUrl = draft?.hasImage ? `/drafts/${draftId}/image` : null

  useEffect(() => {
    if (!draft) return
    if (initializedDraftId.current === draft.id) return
    initializedDraftId.current = draft.id
    setLocal({
      campaignName: draft.campaignName ?? '',
      adSetName: draft.adSetName ?? '',
      dailyBudget: draft.dailyBudget !== null ? String(draft.dailyBudget) : '',
      country: draft.country ?? 'BR',
      ageMin: draft.ageMin !== null ? String(draft.ageMin) : '',
      ageMax: draft.ageMax !== null ? String(draft.ageMax) : '',
      adName: draft.adName ?? '',
      facebookPageName: draft.facebookPageName ?? '',
      title: draft.title ?? '',
      bodyText: draft.bodyText ?? '',
      destinationUrl: draft.destinationUrl ?? '',
      callToAction: draft.callToAction ?? '',
    })
  }, [draft])

  function field(name: string) {
    return local[name] ?? ''
  }

  function setField(name: string, value: string) {
    setLocal((prev) => ({ ...prev, [name]: value }))
  }

  function commitField(name: string, numeric = false) {
    const value = local[name]
    if (draft && value !== String((draft as unknown as Record<string, unknown>)[name] ?? '')) {
      save({ [name]: numeric ? Number(value) : value })
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setImageError(null)
    const errorMessage = await uploadImage(file)
    if (errorMessage) setImageError(errorMessage)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (loading) return <LoadingState label="Carregando rascunho…" />
  if (error || !draft) return <ErrorState description={error ?? 'Rascunho não encontrado.'} />

  const errors = validation?.fieldErrors ?? {}

  return (
    <div>
      <button type="button" className="button button--secondary" onClick={onBack} style={{ marginBottom: 16 }}>
        ← Voltar aos rascunhos
      </button>

      <div className="draft-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`draft-tabs__tab ${tab === t.key ? 'draft-tabs__tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'campanha' && (
          <fieldset disabled={!canWrite} style={{ border: 'none', padding: 0 }}>
            <div className="field">
              <label htmlFor="campaignName">Nome da campanha</label>
              <input
                id="campaignName"
                value={field('campaignName')}
                onChange={(e) => setField('campaignName', e.target.value)}
                onBlur={() => commitField('campaignName')}
              />
              {errors.campaignName && <p className="form-error">{errors.campaignName}</p>}
            </div>
            <p className="reach-note">Objetivo: tráfego para site (único suportado nesta etapa).</p>
          </fieldset>
        )}

        {tab === 'conjunto' && (
          <fieldset disabled={!canWrite} style={{ border: 'none', padding: 0 }}>
            <div className="field">
              <label htmlFor="adSetName">Nome do conjunto</label>
              <input
                id="adSetName"
                value={field('adSetName')}
                onChange={(e) => setField('adSetName', e.target.value)}
                onBlur={() => commitField('adSetName')}
              />
              {errors.adSetName && <p className="form-error">{errors.adSetName}</p>}
            </div>
            <div className="field">
              <label htmlFor="dailyBudget">Orçamento diário (BRL)</label>
              <input
                id="dailyBudget"
                type="number"
                min="0"
                step="0.01"
                value={field('dailyBudget')}
                onChange={(e) => setField('dailyBudget', e.target.value)}
                onBlur={() => commitField('dailyBudget', true)}
              />
              {errors.dailyBudget && <p className="form-error">{errors.dailyBudget}</p>}
            </div>
            <div className="field">
              <label htmlFor="country">País</label>
              <select id="country" value={field('country')} onChange={(e) => { setField('country', e.target.value); save({ country: e.target.value }) }}>
                <option value="BR">Brasil</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="ageMin">Idade mínima</label>
                <input
                  id="ageMin"
                  type="number"
                  min="13"
                  max="65"
                  value={field('ageMin')}
                  onChange={(e) => setField('ageMin', e.target.value)}
                  onBlur={() => commitField('ageMin', true)}
                />
                {errors.ageMin && <p className="form-error">{errors.ageMin}</p>}
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="ageMax">Idade máxima</label>
                <input
                  id="ageMax"
                  type="number"
                  min="13"
                  max="65"
                  value={field('ageMax')}
                  onChange={(e) => setField('ageMax', e.target.value)}
                  onBlur={() => commitField('ageMax', true)}
                />
                {errors.ageMax && <p className="form-error">{errors.ageMax}</p>}
              </div>
            </div>
          </fieldset>
        )}

        {tab === 'anuncio' && (
          <fieldset disabled={!canWrite} style={{ border: 'none', padding: 0 }}>
            <div className="field">
              <label htmlFor="adName">Nome do anúncio</label>
              <input
                id="adName"
                value={field('adName')}
                onChange={(e) => setField('adName', e.target.value)}
                onBlur={() => commitField('adName')}
              />
              {errors.adName && <p className="form-error">{errors.adName}</p>}
            </div>
            <div className="field">
              <label htmlFor="facebookPageName">Página do Facebook</label>
              <input
                id="facebookPageName"
                value={field('facebookPageName')}
                onChange={(e) => setField('facebookPageName', e.target.value)}
                onBlur={() => commitField('facebookPageName')}
              />
              {errors.facebookPageName && <p className="form-error">{errors.facebookPageName}</p>}
            </div>
            <div className="field">
              <label htmlFor="draft-image">Imagem (PNG ou JPEG)</label>
              {canWrite && (
                <input ref={fileInputRef} id="draft-image" type="file" accept="image/png,image/jpeg" onChange={handleFileChange} />
              )}
              {imageError && <p className="form-error">{imageError}</p>}
              {draft.hasImage && (
                <div style={{ marginTop: 8 }}>
                  <img src={imageUrl ?? undefined} alt="" style={{ maxWidth: 200, borderRadius: 8 }} />
                  {canWrite && (
                    <button type="button" className="button button--secondary" style={{ marginLeft: 12 }} onClick={removeImage}>
                      Remover imagem
                    </button>
                  )}
                </div>
              )}
              {errors.image && <p className="form-error">{errors.image}</p>}
            </div>
            <div className="field">
              <label htmlFor="title">Título (até 40 caracteres)</label>
              <input
                id="title"
                maxLength={40}
                value={field('title')}
                onChange={(e) => setField('title', e.target.value)}
                onBlur={() => commitField('title')}
              />
              {errors.title && <p className="form-error">{errors.title}</p>}
            </div>
            <div className="field">
              <label htmlFor="bodyText">Texto (até 125 caracteres)</label>
              <textarea
                id="bodyText"
                maxLength={125}
                rows={3}
                value={field('bodyText')}
                onChange={(e) => setField('bodyText', e.target.value)}
                onBlur={() => commitField('bodyText')}
              />
              {errors.bodyText && <p className="form-error">{errors.bodyText}</p>}
            </div>
            <div className="field">
              <label htmlFor="destinationUrl">URL de destino (HTTPS)</label>
              <input
                id="destinationUrl"
                value={field('destinationUrl')}
                onChange={(e) => setField('destinationUrl', e.target.value)}
                onBlur={() => commitField('destinationUrl')}
                placeholder="https://..."
              />
              {errors.destinationUrl && <p className="form-error">{errors.destinationUrl}</p>}
            </div>
            <div className="field">
              <label htmlFor="callToAction">Chamada para ação</label>
              <select
                id="callToAction"
                value={field('callToAction')}
                onChange={(e) => {
                  setField('callToAction', e.target.value)
                  save({ callToAction: e.target.value as CallToAction })
                }}
              >
                <option value="" disabled>
                  Selecionar…
                </option>
                {Object.entries(CTA_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {errors.callToAction && <p className="form-error">{errors.callToAction}</p>}
            </div>
          </fieldset>
        )}

        {tab === 'revisao' && (
          <div>
            <h2 style={{ marginBottom: 12 }}>Revisão</h2>
            {validation?.complete ? (
              <p className="reach-note" style={{ color: 'var(--color-success)', marginBottom: 12 }}>
                Rascunho completo e válido. Envio à Meta (com confirmação e permissão individual) entra na Etapa 10 —
                nada é enviado a partir daqui.
              </p>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <p className="reach-note" style={{ marginBottom: 6 }}>
                  Pendências antes de poder ser enviado (Etapa 10):
                </p>
                <ul>
                  {Object.values(errors).map((msg, i) => (
                    <li key={i} className="form-error">
                      {msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <AdPreview draft={draft} imageUrl={imageUrl} />
          </div>
        )}
      </div>
    </div>
  )
}
