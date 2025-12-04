# 🚀 Guia do Desenvolvedor - EcoBrasil Gestor

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Setup Local](#setup-local)
4. [Estrutura do Projeto](#estrutura-do-projeto)
5. [Padrões de Código](#padrões-de-código)
6. [Testes](#testes)
7. [Deploy](#deploy)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

**EcoBrasil Gestor** é uma plataforma completa de gestão ambiental e licenciamento com IA integrada.

### Stack Tecnológico

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS + shadcn/ui
- TanStack Query (data fetching)
- Wouter (routing)

**Backend:**
- Node.js + Express
- TypeScript
- PostgreSQL (Neon)
- Drizzle ORM
- Redis (cache)

**IA:**
- OpenAI GPT-4o-mini
- RAG com embeddings
- Context management

**Infraestrutura:**
- GitHub Actions (CI/CD)
- Sentry (monitoring)
- Docker (opcional)

---

## 🏗️ Arquitetura

### Multi-tenancy

Todas as operações são **isoladas por unidade**:
- `goiania`
- `salvador`
- `luiz-eduardo-magalhaes`

### Camadas

```
┌─────────────────┐
│    Frontend     │  React + TypeScript
├─────────────────┤
│    API Layer    │  Express routes
├─────────────────┤
│  Service Layer  │  Business logic
├─────────────────┤
│   Data Layer    │  Drizzle ORM
├─────────────────┤
│    Database     │  PostgreSQL
└─────────────────┘
```

### Feature Flags

Use feature flags para rollout gradual:

```typescript
import { isFeatureEnabledForUser } from './features/featureFlags';

if (await isFeatureEnabledForUser('new_feature', userId)) {
  // New feature code
}
```

---

## 💻 Setup Local

### Requisitos

- Node.js 20+
- PostgreSQL 15+
- Redis (opcional)

### Instalação

```bash
# Clone
git clone https://github.com/ecobrasil/gestor.git
cd gestor

# Install
npm install

# Setup .env
cp .env.example .env
# Edit .env with your credentials

# Database
npm run db:push

# Add indexes (once)
npx tsx server/db/add-indexes.ts

# Start
npm run dev
```

App disponível em: `http://localhost:5000`

---

## 📁 Estrutura do Projeto

```
ecobrasil-gestor/
├── client/               # Frontend React
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route pages
│   │   ├── lib/         # Utilities
│   │   └── test/        # Tests
│   └── public/          # Static assets
├── server/              # Backend Express
│   ├── ai/              # IA services
│   ├── cache/           # Redis cache
│   ├── middleware/      # Express middlewares
│   ├── utils/           # Utilities
│   ├── monitoring/      # Sentry, analytics
│   ├── backup/          # Backup service
│   ├── features/        # Feature flags
│   └── routes.ts        # API routes
├── shared/              # Shared code
│   └── schema.ts        # Database schema
├── e2e/                 # E2E tests
└── docs/                # Documentation
```

---

## 💡 Padrões de Código

### API Routes

```typescript
// Always require auth
app.get('/api/resource', requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  
  // Get data
  const data = await storage.getData(userId);
  
  // Return
  res.json(data);
});
```

### Audit Logging

```typescript
import { logCreate, logUpdate, logDelete } from './utils/audit';

// After CREATE
await logCreate(userId, unidade, 'entity', id, data, req);

// After UPDATE
await logUpdate(userId, unidade, 'entity', id, oldData, newData, req);

// After DELETE
await logDelete(userId, unidade, 'entity', id, data, req);
```

### Cache Usage

```typescript
import { cacheGetOrSet, cacheKey, CacheTTL } from './cache/cacheService';

const data = await cacheGetOrSet(
  cacheKey('resource', userId),
  async () => await fetchExpensiveData(),
  CacheTTL.DASHBOARD_STATS // 5 min
);
```

### Error Handling

```typescript
import { captureException } from './monitoring/sentry';

try {
  // Risky operation
} catch (err) {
  captureException(err, { userId, context });
  res.status(500).json({ message: 'Internal error' });
}
```

---

## 🧪 Testes

### Unit Tests

```bash
npm run test              # Watch mode
npm run test:unit         # Run once
npm run test:coverage     # With coverage
```

### E2E Tests

```bash
npm run test:e2e          # Headless
npm run test:e2e:ui       # With UI
```

### Writing Tests

```typescript
// Unit test
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
  it('should return correct value', () => {
    expect(myFunction(input)).toBe(expected);
  });
});

// E2E test
import { test, expect } from '@playwright/test';

test('should login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'test@test.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
});
```

---

## 🚀 Deploy

### Build

```bash
npm run build
```

### Production

```bash
npm run start
```

### Environment Variables

Ver [.env.example](.env.example) para todas as variáveis necessárias.

**Obrigatórias:**
- `DATABASE_URL`
- `SESSION_SECRET` (min 32 chars)

**Opcionais:**
- `REDIS_URL` (cache)
- `OPENAI_API_KEY` (IA)
- `SENTRY_DSN` (monitoring)

---

## 🐛 Troubleshooting

### Banco de dados não conecta

```bash
# Verficar .env
cat .env | grep DATABASE_URL

# Testar conexão
psql $DATABASE_URL
```

### Cache não funciona

```bash
# Verificar Redis
redis-cli ping
# Deve retornar: PONG

# Se não tiver Redis, app funciona sem cache
```

### Testes falhando

```bash
# Limpar node_modules
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

---

## 📚 Recursos Adicionais

- [API Docs](http://localhost:5000/api-docs)
- [Guia do Usuário](./USER_GUIDE.md)
- [FAQ](./FAQ.md)

---

**Dúvidas?** Abra uma issue no GitHub!
