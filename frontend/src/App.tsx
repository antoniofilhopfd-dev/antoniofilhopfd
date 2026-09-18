import { useEffect, useState } from 'react'
import './App.css'

type HealthResponse = {
  status: 'ok' | 'error'
  api: 'up' | 'down'
  database: 'up' | 'down'
  timestamp: string
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/health')
      .then((response) => response.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setError('Não foi possível contatar o backend.'))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Evolução Tráfego — Diagnóstico</h1>
      <p>Tela temporária da Etapa 1 (Base local). O layout definitivo será implementado na Etapa 3.</p>
      {error && <p role="alert">{error}</p>}
      {health && (
        <ul>
          <li>API: {health.api}</li>
          <li>Banco de dados: {health.database}</li>
          <li>Status geral: {health.status}</li>
          <li>Consultado em: {health.timestamp}</li>
        </ul>
      )}
    </main>
  )
}

export default App
