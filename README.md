# Evolução Tráfego

Aplicação nova (construída do zero, sem reaproveitar código de protótipos anteriores) para o Colégio Evolução acompanhar investimento e resultados de tráfego pago (Meta Ads), produzir relatórios e, em etapas futuras, preparar campanhas pausadas para revisão.

Status atual: **Etapa 1 — Base local**, concluída. Demais etapas seguem o planejamento aprovado, uma de cada vez.

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
npm run dev             # sobe em http://localhost:3333
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # sobe em http://localhost:5173
```

O frontend faz proxy de `/health` para o backend (configurado em `vite.config.ts`).

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
