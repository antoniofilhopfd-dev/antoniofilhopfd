import { MetaIntegrationPanel } from './MetaIntegrationPanel'

export function AdministracaoScreen() {
  return (
    <div>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
        Gestão de usuários, instituição e auditoria entram em etapas seguintes. Integração Meta
        disponível abaixo (Etapa 6).
      </p>
      <MetaIntegrationPanel />
    </div>
  )
}
