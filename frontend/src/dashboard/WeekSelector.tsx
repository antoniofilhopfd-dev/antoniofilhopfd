import type { WeekListItem } from './types'
import { formatDatePtBr } from './format'

type WeekSelectorProps = {
  weeks: WeekListItem[]
  selected: string | null
  onChange: (weekStart: string) => void
}

export function WeekSelector({ weeks, selected, onChange }: WeekSelectorProps) {
  return (
    <div className="field" style={{ maxWidth: 320 }}>
      <label htmlFor="week-select">Semana</label>
      <select
        id="week-select"
        value={selected ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {weeks.map((week) => (
          <option key={week.weekStart} value={week.weekStart}>
            {formatDatePtBr(week.weekStart)} – {formatDatePtBr(week.weekEnd)}
            {week.isPartial ? ' (parcial)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
