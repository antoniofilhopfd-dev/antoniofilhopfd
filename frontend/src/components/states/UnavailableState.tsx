type UnavailableStateProps = {
  label: string
  stage?: number
}

export function UnavailableState({ label, stage }: UnavailableStateProps) {
  return (
    <div className="state-box state-box--unavailable" role="status">
      <p className="state-box__title">{label} ainda não disponível</p>
      <p className="state-box__description">
        {stage
          ? `Esta área entra no planejamento na Etapa ${stage}, ainda não iniciada.`
          : 'Esta área ainda não foi implementada.'}
      </p>
    </div>
  )
}
