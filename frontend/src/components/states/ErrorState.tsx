type ErrorStateProps = {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Não foi possível carregar esta informação.',
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="state-box state-box--error" role="alert">
      <p className="state-box__title">{title}</p>
      {description && <p className="state-box__description">{description}</p>}
      {onRetry && (
        <button type="button" className="button button--secondary" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}
