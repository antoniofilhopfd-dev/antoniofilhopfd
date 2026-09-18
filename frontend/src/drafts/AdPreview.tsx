import type { Draft } from './types'
import { CTA_LABEL } from './types'

type AdPreviewProps = {
  draft: Draft
  imageUrl: string | null
}

function extractHostname(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function AdPreview({ draft, imageUrl }: AdPreviewProps) {
  return (
    <div className="ad-preview">
      <p className="ad-preview__label">Prévia do anúncio</p>
      <div className="ad-preview__card">
        <div className="ad-preview__page">{draft.facebookPageName || 'Página do Facebook'}</div>
        {imageUrl ? (
          <img src={imageUrl} alt="" className="ad-preview__image" />
        ) : (
          <div className="ad-preview__image ad-preview__image--empty">Sem imagem</div>
        )}
        <div className="ad-preview__body">
          <p className="ad-preview__domain">{extractHostname(draft.destinationUrl) ?? 'destino.com.br'}</p>
          <p className="ad-preview__title">{draft.title || 'Título do anúncio'}</p>
          <p className="ad-preview__text">{draft.bodyText || 'Texto do anúncio.'}</p>
        </div>
        <div className="ad-preview__cta">{draft.callToAction ? CTA_LABEL[draft.callToAction] : 'Chamada para ação'}</div>
      </div>
    </div>
  )
}
