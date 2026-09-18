import type { WeekTotals } from './types'
import { formatCurrency, formatNumber, formatPercent } from './format'

type KpiGridProps = {
  totals: WeekTotals
}

export function KpiGrid({ totals }: KpiGridProps) {
  const items = [
    { label: 'Investimento', value: formatCurrency(totals.spend) },
    { label: 'Resultados (conversas iniciadas)', value: formatNumber(totals.resultsConversations) },
    { label: 'Custo por resultado', value: formatCurrency(totals.costPerResult) },
    { label: 'Impressões', value: formatNumber(totals.impressions) },
    { label: 'Cliques totais', value: formatNumber(totals.clicksTotal) },
    { label: 'Cliques no link', value: formatNumber(totals.clicksLink) },
    { label: 'CTR (sobre cliques no link)', value: formatPercent(totals.ctr) },
    { label: 'CPC (sobre cliques no link)', value: formatCurrency(totals.cpc) },
    { label: 'CPM', value: formatCurrency(totals.cpm) },
  ]

  return (
    <dl className="kpi-grid">
      {items.map((item) => (
        <div className="kpi-grid__item card" key={item.label}>
          <dt className="kpi-grid__label">{item.label}</dt>
          <dd className="kpi-grid__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
