# Sale360 — PDV SaaS Multiplataforma

Sistema PDV (Ponto de Venda) SaaS com **offline-first**, funcionando no celular e PC.
Inspirado nos melhores sistemas do mercado brasileiro (Kyte, Consumer, Tray).

## Design Principles

- **2 toques para vender** — fluxo de venda otimizado: escanear/tocar → pagar
- **Offline-first** — PDV nunca para, sincroniza quando a internet voltar
- **Mobile-first** — desenhado para celular, expandido para PC
- **Zero surpresa** — preço fixo, sem comissão sobre vendas

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Mobile | React Native + Expo |
| Web Admin | Next.js 15 |
| API | Fastify (Node.js) |
| Database | PostgreSQL 16 (Neon Tech) |
| ORM | Prisma 6 |
| Cache | Redis |
| Sync | Engine próprio (push/pull) |
| Offline DB | SQLite (expo-sqlite) |

## Estrutura do Projeto

```
sale360/
├── apps/
│   ├── mobile/        # React Native Expo — PDV no celular
│   └── web/           # Next.js — Painel admin
├── packages/
│   ├── core/          # Lógica de negócio compartilhada
│   ├── db/            # Schema Prisma + migrações
│   ├── api/           # Fastify API server
│   ├── sync/          # Engine de sincronização offline
│   └── payments/      # Integração Mercado Pago
├── docker/            # Docker Compose + Dockerfiles
└── .github/           # CI/CD
```

## Funcionalidades

### Plano PRO (R$49,90/mês)
- PDV no celular com câmera (leitor código barras)
- Catálogo online (link compartilhável)
- Controle de estoque
- Controle de fiado
- Fluxo de caixa
- Recibos digitais

### Plano GROW (R$69,90/mês)
- Tudo do PRO +:
- PDV no PC (navegador)
- IA para descrições de produtos
- 2 variações por produto
- Importação em massa
- 10 usuários/vendedores
- Gestão de fornecedores
- Gastos recorrentes

### Plano PRIME (R$99,90/mês)
- Tudo do GROW +:
- Usuários ilimitados
- Assistente IA completo
- Cadastro Mágico (IA)
- Atendimento prioritário
- Atendimento WhatsApp
- Atendimento aos sábados
- Videochamada com suporte

## Começando

### Pré-requisitos
- Node.js 20+
- pnpm 9+
- Docker (opcional, para dev local)

### Setup rápido

```bash
# Instalar dependências
pnpm install

# Gerar Prisma client
pnpm db:generate

# Subir banco de dados (Docker)
pnpm docker:up

# Rodar migrations
pnpm db:push

# Seed de dados demo
pnpm --filter=@sale360/db db:seed

# Iniciar tudo em dev
pnpm dev
```

### Serviços

| Serviço | URL |
|---------|-----|
| API | http://localhost:3001 |
| Web Admin | http://localhost:3000 |
| Prisma Studio | pnpm db:studio |

### Login Demo
- Email: admin@sale360.app
- Senha: admin123

## Banco de Dados

O projeto está configurado para usar **Neon Tech PostgreSQL** (Serverless).
A connection string está em `packages/db/.env`.

Para desenvolvimento local, use o Docker Compose:
```bash
pnpm docker:up  # Sobe PostgreSQL + Redis
```

## Offline-First

O PDV continua funcionando sem internet:

1. **Primeiro acesso** — baixa catálogo completo
2. **Offline** — vendas salvas em SQLite local
3. **Online** — sincronização automática push/pull
4. **Conflitos** — resolvidos por Last-Write-Wins + timestamp

Indicador de status no app:
- 🟢 Online — Tudo sincronizado
- 🟡 Sincronizando — X pendentes
- 🔴 Offline — Modo local

## Módulos Principais

| Módulo | Offline | Descrição |
|--------|---------|-----------|
| PDV Core | Sim | Registrar venda, checkout |
| Catálogo | Leitura | Produtos, preços, variações |
| Estoque | Sim | Entrada, saída, alertas |
| Clientes | Sim | Cadastro, fiado, créditos |
| Comandas | Sim | Mesas, pedidos abertos |
| Delivery | Online | Gestão de entregas |
| Financeiro | Leitura | Fluxo de caixa, relatórios |

## Scripts

```bash
pnpm dev              # Dev mode (tudo)
pnpm dev:mobile       # Só app mobile
pnpm dev:web          # Só web admin
pnpm dev:api          # Só API
pnpm build            # Build de todos os pacotes
pnpm lint             # Lint
pnpm typecheck        # Verificação de tipos
pnpm db:studio        # Prisma Studio (DB visual)
pnpm docker:up        # Sobe infra (Postgres + Redis)
pnpm docker:down      # Para infra
```

## Licença

Proprietária. Todos os direitos reservados.
