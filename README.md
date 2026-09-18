# Evolução Tráfego

Aplicação nova (construída do zero, sem reaproveitar código de protótipos anteriores) para o Colégio Evolução acompanhar investimento e resultados de tráfego pago (Meta Ads), produzir relatórios e, em etapas futuras, preparar campanhas pausadas para revisão.

Status atual: **Etapa 7 — Sincronização robusta**, concluída tecnicamente e testada com respostas simuladas (Etapas 1–6 também concluídas). Operação real pendente de credenciais Meta — ver seção abaixo. Demais etapas seguem o planejamento aprovado, uma de cada vez.

## Arquitetura

- `backend/`: Node.js + Express + TypeScript, PostgreSQL via Prisma.
- `frontend/`: React + TypeScript + Vite.

Aplicação modular única (sem microserviços).

## Pré-requisitos

- Node.js 20+
- PostgreSQL 16 rodando localmente (ou acessível pela `DATABASE_URL`)

## Como rodar (desenvolvimento)

### Backend

```bash
cd backend
cp .env.example .env   # ajuste DATABASE_URL se necessário
npm install
npm run prisma:migrate
npm run seed:admin       # cria o primeiro usuário Administrador (interativo, sem credenciais padrão)
npm run seed:demo-metrics  # gera ~8 semanas de métricas diárias de DEMONSTRAÇÃO (isDemo=true)
npm run seed:demo-hierarchy  # gera campanhas/conjuntos/anúncios de DEMONSTRAÇÃO com métricas
npm run dev              # sobe em http://localhost:3333
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # sobe em http://localhost:5173
```

O frontend faz proxy de `/health`, `/auth`, `/users`, `/metrics`, `/campaigns`, `/adsets`, `/ads` e `/integrations` para o backend (configurado em `vite.config.ts`).

## Acesso (Etapa 2)

- Login por e-mail/senha, sessão em cookie httpOnly (`evolucao_session`), expiração em 12h.
- Perfis: `ADMIN` (gerencia usuários e integrações), `MANAGER` (cria/edita rascunhos; só envia à Meta se `canSubmitToMeta` for concedido por um Admin), `VIEWER` (somente consulta).
- Toda autorização é verificada no backend (middlewares `requireAuth`/`requireRole`), não apenas ocultada na interface.
- Bloqueio automático de conta por 15 minutos após 5 tentativas de senha incorreta seguidas; limite adicional de requisições de login por IP.
- Não há credenciais padrão fixas: o primeiro Administrador é criado via `npm run seed:admin` (interativo).

## Navegação e identidade visual (Etapa 3)

- Tema visual aplicado globalmente: azul-marinho (`--color-navy`) e laranja (`--color-orange`) das Seções 7/20, fundo claro, tipografia Objectivity.
- Logo oficial: versão colorida em telas com fundo branco (login), versão branca em fundos escuros (menu lateral, cabeçalho mobile) — usar sempre a variante correta por contraste.
- Menu lateral fixo no desktop (`AppShell`), navegação retrátil com overlay no celular (`< 900px`), sem rolagem horizontal.
- Itens de menu visíveis conforme perfil (ex.: "Administração" só aparece para `ADMIN`).
- Itens ainda não implementados mostram explicação de indisponibilidade com a etapa do planejamento em que entram, em vez de tela vazia ou botão morto.
- Componentes reutilizáveis de estado em `frontend/src/components/states/`: `EmptyState`, `LoadingState`, `ErrorState`, `UnavailableState`.
- Acessibilidade: link "pular para o conteúdo", foco visível com contraste (inclusive sobre o menu azul-marinho), navegação por teclado testada.

## Dashboard e semanas (Etapa 4)

- Semanas domingo–sábado; cálculo em UTC nesta etapa (dados de demonstração) — revisar fuso da conta na Etapa 6.
- "Resultados" = conversas iniciadas (decisão registrada na Seção 20; não é lead nem matrícula).
- Totais aditivos (investimento, resultados, impressões, cliques) somados corretamente; CTR/CPC/CPM calculados sobre os totais da semana, não médias de taxas diárias.
- Alcance e frequência não são somados entre dias (evita contar a mesma pessoa mais de uma vez) — disponíveis só no gráfico diário.
- Semana parcial identificada e comparação com a semana anterior restrita ao número de dias disponíveis em ambas.
- Banner "Dados de demonstração" enquanto os registros tiverem `isDemo=true`; nenhuma integração real com o Meta nesta etapa (isso é a Etapa 6).
- Gerar dados de demonstração: `npm run seed:demo-metrics` (backend).

## Hierarquia (Etapa 5)

- `Campaign` → `AdSet` → `Ad`, com integridade referencial (FKs, `onDelete: Cascade` do pai para os filhos).
- Métricas diárias armazenadas no nível do Anúncio (`AdDailyMetric`); totais de Conjunto e Campanha são somados a partir dos anúncios filhos — simplificação a revisar na Etapa 6, quando a API do Meta puder fornecer agregados próprios por nível (podem não ser idênticos à soma dos filhos).
- Segmentos propostos (Educação Infantil, Anos Iniciais, Anos Finais, Ensino Médio, Institucional, Outros) — a confirmar, já que não há classificação anterior de protótipo disponível.
- Classificação manual (`segmentSource="manual"`) protegida contra sobrescrita por importações futuras — verificado em teste automatizado e manualmente (reseed não altera classificação já definida por um usuário).
- Listagens de Campanhas e Anúncios com busca por nome, filtro por status (e segmento, nas campanhas), paginação. Anúncios é consulta transversal (não aninhada em campanha/conjunto).
- Classificação de campanha só pode ser alterada por `ADMIN` ou `MANAGER` (verificado no backend).
- Gerar dados de demonstração: `npm run seed:demo-hierarchy` (backend; idempotente, não sobrescreve classificação manual).

## Integração Meta (Etapa 6)

- **Status real: NÃO CONFIGURADO / NÃO HOMOLOGADO.** Sem `META_ACCESS_TOKEN` e `META_AD_ACCOUNT_ID` no `.env`, a integração fica genuinamente "não configurada" — a interface nunca simula uma conexão (Seção 7/11).
- Configuração exclusiva por variável de ambiente (nunca editável pela interface): `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`. Versão da API fixada em `backend/src/meta/config.ts` (`v21.0`) — revisar changelog oficial antes de atualizar.
- Paginação da API nunca segue URLs fora do domínio `graph.facebook.com` (proteção contra redirecionamento arbitrário — Seção 11), testado com uma URL de paginação maliciosa simulada.
- Erros mapeados por tipo (`invalid_token`, `permission`, `rate_limit`) com tentativas limitadas (retry só em 429).
- Sincronização de hierarquia usa `externalId` estável (upsert), preserva classificação manual (`segmentSource="manual"`), rejeita o lote inteiro sem gravar nada se faltar um campo obrigatório, e é protegida contra execução concorrente (trava em `MetaConnection.isSyncing`).
- Sincronização de métricas grava `AdDailyMetric` com `isDemo=false`, "Resultados" mapeado do action_type `onsite_conversion.messaging_conversation_started_7d` (conversas iniciadas, conforme decisão da Seção 20).
- Log de cada sincronização (`SyncLog`) com status, itens processados e erro, visível no painel Administração → Integração Meta.
- Toda a lógica de sincronização foi testada com um cliente Meta **simulado** (sem rede real) — 13 testes cobrindo conexão ok/token inválido/não configurado, integridade da hierarquia, preservação de classificação manual, rejeição de lote inconsistente, trava de concorrência, gravação de métricas e restrição de paginação.
- **Não afirmar que a leitura Meta está "pronta para produção"**: falta homologação com uma conta real autorizada (Seção 3/6 da especificação).

## Sincronização robusta (Etapa 7)

- Dois modos distintos no painel: "Atualizar recentes" (7 dias) e "Importação histórica" (90 dias), ambos via o mesmo caminho transacional da Etapa 6.
- Agendamento automático opcional via `META_SYNC_INTERVAL_MINUTES` (minutos): só roda enquanto o processo Node deste servidor estiver de pé — **não equivale a hospedagem permanente** (VPS foi adiada pelo usuário, Seção 4). Painel mostra "Agendamento automático: Ativo/Inativo" com base no estado real do processo, nunca simulado.
- Falha a meio da paginação de métricas não grava nenhum dado parcial (a busca de todas as páginas acontece antes de a transação começar a escrever) — verificado em teste automatizado.
- Execução repetida da sincronização (hierarquia + métricas) não duplica registros — upsert por identificador estável, testado rodando duas vezes seguidas.
- Trava de concorrência (Etapa 6) reforçada com teste de disparo real do agendador em intervalo curto.
- Configurar: adicionar `META_SYNC_INTERVAL_MINUTES` ao `.env` do backend (deixar ausente mantém o agendamento desligado).

## Testes

```bash
cd backend
npm test
```

## Banco de dados de desenvolvimento (referência)

Usuário e banco criados localmente nesta etapa:

```sql
CREATE USER evolucao_trafego WITH PASSWORD 'evolucao_dev_local' CREATEDB;
CREATE DATABASE evolucao_trafego OWNER evolucao_trafego;
```

Ajuste credenciais para o seu ambiente; não usar essas credenciais em produção.
