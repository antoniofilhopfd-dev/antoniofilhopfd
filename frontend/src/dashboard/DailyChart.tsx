import type { DailyMetricRow } from './types'
import { formatDatePtBr } from './format'

type DailyChartProps = {
  daily: DailyMetricRow[]
}

const WIDTH = 720
const HEIGHT = 220
const PADDING = { top: 16, right: 16, bottom: 32, left: 16 }

export function DailyChart({ daily }: DailyChartProps) {
  if (daily.length === 0) {
    return null
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const barWidth = plotWidth / daily.length

  const maxSpend = Math.max(...daily.map((d) => d.spend), 1)
  const maxResults = Math.max(...daily.map((d) => d.resultsConversations), 1)

  const barPoints = daily.map((d, i) => {
    const barHeight = (d.spend / maxSpend) * plotHeight
    const x = PADDING.left + i * barWidth
    const y = PADDING.top + (plotHeight - barHeight)
    return { x, y, height: barHeight, day: d }
  })

  const linePoints = daily.map((d, i) => {
    const x = PADDING.left + i * barWidth + barWidth / 2
    const y = PADDING.top + plotHeight - (d.resultsConversations / maxResults) * plotHeight
    return `${x},${y}`
  })

  return (
    <figure className="daily-chart">
      <figcaption className="visually-hidden">
        Gráfico diário: barras de investimento (R$) e linha de resultados (conversas iniciadas) por dia.
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Investimento diário (barras) e resultados diários (linha)"
        className="daily-chart__svg"
      >
        {barPoints.map(({ x, y, height, day }) => (
          <g key={day.date}>
            <rect
              x={x + barWidth * 0.15}
              y={y}
              width={barWidth * 0.7}
              height={height}
              rx={3}
              className="daily-chart__bar"
            />
            <text
              x={x + barWidth / 2}
              y={HEIGHT - PADDING.bottom + 16}
              textAnchor="middle"
              className="daily-chart__axis-label"
            >
              {formatDatePtBr(day.date).slice(0, 5)}
            </text>
          </g>
        ))}
        <polyline points={linePoints.join(' ')} className="daily-chart__line" fill="none" />
        {daily.map((d, i) => {
          const x = PADDING.left + i * barWidth + barWidth / 2
          const y = PADDING.top + plotHeight - (d.resultsConversations / maxResults) * plotHeight
          return <circle key={d.date} cx={x} cy={y} r={3} className="daily-chart__point" />
        })}
      </svg>
      <div className="daily-chart__legend">
        <span>
          <span className="daily-chart__legend-swatch daily-chart__legend-swatch--bar" /> Investimento
        </span>
        <span>
          <span className="daily-chart__legend-swatch daily-chart__legend-swatch--line" /> Resultados
          (conversas)
        </span>
      </div>
    </figure>
  )
}
