# Evolução Tráfego

Aplicação nova (construída do zero, sem reaproveitar código de protótipos anteriores) para o Colégio Evolução acompanhar investimento e resultados de tráfego pago (Meta Ads), produzir relatórios e, em etapas futuras, preparar campanhas pausadas para revisão.

Status atual: **Etapa 3 — Navegação**, concluída (Etapas 1 e 2 também concluídas). Demais etapas seguem o planejamento aprovado, uma de cada vez.

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
npm run dev              # sobe em http://localhost:3333
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # sobe em http://localhost:5173
```

O frontend faz proxy de `/health`, `/auth` e `/users` para o backend (configurado em `vite.config.ts`).

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
