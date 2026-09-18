type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'Carregando…' }: LoadingStateProps) {
  return (
    <div className="state-box state-box--loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p className="state-box__title">{label}</p>
    </div>
  )
}
