# Evolução Tráfego

Aplicação nova (construída do zero, sem reaproveitar código de protótipos anteriores) para o Colégio Evolução acompanhar investimento e resultados de tráfego pago (Meta Ads), produzir relatórios e, em etapas futuras, preparar campanhas pausadas para revisão.

Status atual: **Etapa 9 — Rascunhos**, concluída. MVP de acompanhamento (Etapas 1–8) já entregue; integração Meta segue pendente de credenciais reais. Demais etapas (criação pausada, XLSX, Sheets) seguem o planejamento aprovado, uma de cada vez.

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

O frontend faz proxy de `/health`, `/auth`, `/users`, `/metrics`, `/campaigns`, `/adsets`, `/ads`, `/integrations`, `/observations`, `/reports` e `/drafts` para o backend (configurado em `vite.config.ts`).

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

## Relatórios MVP (Etapa 8)

- **Não há PDF de referência do protótipo neste pacote.** O layout do PDF abaixo é uma PROPOSTA seguindo a identidade visual já aplicada (Etapa 3) — apresentada para aprovação, não uma reprodução do PDF refinado citado na Seção 13.
- Observações semanais com autoria (`WeeklyObservation`), várias por semana; só o próprio autor ou um `ADMIN` pode remover.
- PDF (`GET /reports/weeks/:weekStart/pdf`): cabeçalho azul-marinho com logo oficial, título "Relatório de Tráfego Pago", período com indicação de semana completa/parcial, indicadores, gráfico diário, tabelas de campanhas/conjuntos/anúncios, observações com autoria, numeração de página.
  - Durante a validação, encontrei e corrigi dois bugs reais de renderização: (1) o cursor de texto do PDFKit "herdava" a posição X da última célula de tabela desenhada, espremendo títulos de seção numa coluna estreita — corrigido fixando X explicitamente após tabelas/gráfico; (2) o rodapé de numeração, por ficar dentro da margem inferior, fazia o PDFKit criar páginas extras em branco a cada rodapé desenhado — corrigido zerando a margem temporariamente ao desenhar o rodapé. Ambos cobertos por teste automatizado (o segundo como teste de regressão) e conferidos visualmente renderizando o PDF gerado como imagem.
- CSV (`GET /reports/weeks/:weekStart/csv`): compatível com Excel (BOM UTF-8, separador `;`, decimal com vírgula), protege campos de texto contra injeção de fórmula sem alterar números legítimos.
- Ambas as exportações sempre correspondem à semana selecionada na tela (mesmo escopo tela↔arquivo, conforme exige a Seção 13).

## Rascunhos (Etapa 9)

- Escopo mantido conforme Seção 12: tráfego para site HTTPS com imagem, um conjunto e um anúncio por rascunho, orçamento em BRL, público amplo por país/idade. **Não envia nada** — isso é a Etapa 10.
- Editor com abas Campanha/Conjunto/Anúncio/Revisão (melhoria da Seção 7); cada campo é salvo ao perder o foco (persistência incremental), permitindo fechar e recarregar sem perder o que já foi preenchido.
- Imagem PNG/JPEG (até 5MB) armazenada localmente em `backend/uploads/drafts/` (gitignored; metadados no banco, bytes fora do repositório — Seção 15), servida só para usuários autenticados com acesso ao rascunho.
- Validação por campo no backend (URL HTTPS, orçamento > 0, idade 13–65, imagem obrigatória, limites de caracteres) — mostrada na aba Revisão sem bloquear salvar um rascunho incompleto.
- Bloco "Prévia do anúncio" (Seção 7): imagem, página, título, texto, destino e botão de chamada para ação juntos.
- Permissões: Admin e Gestor criam/editam; Gestor só vê/edita os próprios rascunhos, Admin vê todos; Visualizador não pode criar nem editar.
- Durante a validação manual encontrei e corrigi dois bugs reais de UX: (1) salvar um campo (`onBlur`) resincronizava TODOS os campos locais a partir da resposta do servidor, apagando edições ainda não salvas de outros campos preenchidos na mesma interação — corrigido sincronizando o estado local só na primeira carga do rascunho; (2) requisições de salvamento/validação concorrentes podiam chegar fora de ordem e sobrescrever dados mais novos com uma resposta mais antiga — corrigido com um número de sequência que descarta respostas desatualizadas.

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
