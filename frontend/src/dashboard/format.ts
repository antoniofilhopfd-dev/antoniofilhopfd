const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const numberFormatter = new Intl.NumberFormat('pt-BR')

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(value: number | null): string {
  if (value === null) return 'indisponível'
  return currencyFormatter.format(value)
}

export function formatNumber(value: number | null): string {
  if (value === null) return 'indisponível'
  return numberFormatter.format(value)
}

export function formatPercent(value: number | null): string {
  if (value === null) return 'indisponível'
  return `${percentFormatter.format(value)}%`
}

export function formatDatePtBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}
