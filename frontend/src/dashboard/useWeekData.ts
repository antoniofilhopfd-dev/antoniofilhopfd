import { useEffect, useState } from 'react'
import type { WeekComparison, WeekListItem } from './types'

type State = {
  weeks: WeekListItem[]
  selectedWeekStart: string | null
  comparison: WeekComparison | null
  loading: boolean
  error: string | null
}

export function useWeekData() {
  const [state, setState] = useState<State>({
    weeks: [],
    selectedWeekStart: null,
    comparison: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function loadWeeks() {
      try {
        const response = await fetch('/metrics/weeks', { credentials: 'same-origin' })
        if (!response.ok) throw new Error('Falha ao carregar semanas.')
        const weeks: WeekListItem[] = await response.json()
        if (cancelled) return

        setState((prev) => ({
          ...prev,
          weeks,
          selectedWeekStart: weeks[0]?.weekStart ?? null,
          loading: weeks.length > 0,
        }))

        if (weeks.length === 0) {
          setState((prev) => ({ ...prev, loading: false }))
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: 'Não foi possível carregar as semanas disponíveis.' }))
        }
      }
    }

    loadWeeks()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state.selectedWeekStart) return
    let cancelled = false

    setState((prev) => ({ ...prev, loading: true, error: null }))

    fetch(`/metrics/weeks/${state.selectedWeekStart}/compare`, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Falha ao carregar dados da semana.')
        return response.json()
      })
      .then((comparison: WeekComparison) => {
        if (!cancelled) setState((prev) => ({ ...prev, comparison, loading: false }))
      })
      .catch(() => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false, error: 'Não foi possível carregar os dados desta semana.' }))
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedWeekStart])

  function selectWeek(weekStart: string) {
    setState((prev) => ({ ...prev, selectedWeekStart: weekStart }))
  }

  return { ...state, selectWeek }
}
