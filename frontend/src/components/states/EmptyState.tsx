type EmptyStateProps = {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="state-box state-box--empty" role="status">
      <p className="state-box__title">{title}</p>
      {description && <p className="state-box__description">{description}</p>}
    </div>
  )
}
