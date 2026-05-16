# Sale360 — PDV SaaS Multiplataforma

## Stack
- **Mobile:** React Native + Expo (offline-first com SQLite/WatermelonDB)
- **Web:** Next.js 14+ App Router (painel admin + catálogo público)
- **API:** Fastify + TypeScript
- **DB:** PostgreSQL 16 + Prisma ORM (multi-tenant via RLS)
- **Cache:** Redis (Valkey)
- **Sync:** Engine próprio (push/pull com fila baseada em WatermelonDB sync protocol)

## Princípios de Design
1. **Menos cliques** — Toda ação deve ser completada em até 2 toques
2. **Offline-first** — O PDV nunca para, mesmo sem internet
3. **Mobile-first** — Design pensado para celular, expandido para PC
4. **Zero surpresa** — Preço fixo, sem comissão, sem contrato

## Estrutura
```
apps/
  mobile/    — React Native Expo (PDV no celular)
  web/       — Next.js (painel admin PDV)
  catalog/   — Next.js (catálogo público do lojista)
packages/
  core/      — Lógica de negócio (planos, features, utils)
  db/        — Schema Prisma + migrações + seed
  api/       — Fastify API server
  sync/      — Engine de sincronização offline
  payments/  — Integração Mercado Pago, Pix
  ui/        — Componentes compartilhados (Tailwind + shadcn)
```

## Comandos
```
pnpm dev              # Todos os serviços em dev
pnpm dev:mobile       # Só o app mobile
pnpm dev:web          # Só o painel web
pnpm db:studio        # Prisma Studio
pnpm docker:up        # Sobe PostgreSQL + Redis
```
