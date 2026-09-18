import type { WeekComparison } from './types'
import { formatCurrency, formatDatePtBr, formatNumber } from './format'

type ComparisonTableProps = {
  comparison: WeekComparison
}

function deltaLabel(current: number, previous: number): { text: string; className: string } {
  if (previous === 0) {
    return { text: '—', className: '' }
  }
  const delta = ((current - previous) / previous) * 100
  const sign = delta > 0 ? '+' : ''
  return {
    text: `${sign}${delta.toFixed(1)}%`,
    className: delta > 0 ? 'comparison-delta--up' : delta < 0 ? 'comparison-delta--down' : '',
  }
}

export function ComparisonTable({ comparison }: ComparisonTableProps) {
  const rows: { label: string; current: number; previous: number; format: (n: number) => string }[] = [
    {
      label: 'Investimento',
      current: comparison.currentComparable.spend,
      previous: comparison.previousComparable.spend,
      format: (n) => formatCurrency(n),
    },
    {
      label: 'Resultados (conversas)',
      current: comparison.currentComparable.resultsConversations,
      previous: comparison.previousComparable.resultsConversations,
      format: (n) => formatNumber(n),
    },
    {
      label: 'Impressões',
      current: comparison.currentComparable.impressions,
      previous: comparison.previousComparable.impressions,
      format: (n) => formatNumber(n),
    },
    {
      label: 'Cliques no link',
      current: comparison.currentComparable.clicksLink,
      previous: comparison.previousComparable.clicksLink,
      format: (n) => formatNumber(n),
    },
  ]

  return (
    <div className="card">
      <h2 style={{ marginBottom: 8 }}>
        Comparação com semana anterior ({formatDatePtBr(comparison.previous.weekStart)} –{' '}
        {formatDatePtBr(comparison.previous.weekEnd)})
      </h2>
      {comparison.comparisonNote && <p className="reach-note">{comparison.comparisonNote}</p>}
      <table className="comparison-table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th scope="col">Métrica</th>
            <th scope="col" className="numeric">
              Semana atual
            </th>
            <th scope="col" className="numeric">
              Semana anterior
            </th>
            <th scope="col" className="numeric">
              Variação
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const delta = deltaLabel(row.current, row.previous)
            return (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td className="numeric">{row.format(row.current)}</td>
                <td className="numeric">{row.format(row.previous)}</td>
                <td className={`numeric ${delta.className}`}>{delta.text}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
