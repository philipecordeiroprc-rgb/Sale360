import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth/index.js';
import { productRoutes } from './routes/products/index.js';
import { orderRoutes } from './routes/orders/index.js';
import { customerRoutes } from './routes/customers/index.js';
import { commandRoutes } from './routes/commands/index.js';
import { financeRoutes } from './routes/finance/index.js';
import { tenantRoutes } from './routes/tenant/index.js';
import { syncRoutes } from './routes/sync/index.js';
import { integrationRoutes } from './routes/integrations/index.js';
import { categoriesRoutes } from './routes/categories/index.js';
import { variationTemplateRoutes } from './routes/variation-templates/index.js';
import { supplierRoutes } from './routes/suppliers/index.js';
import { purchaseRoutes } from './routes/purchases/index.js';
import { inventoryRoutes } from './routes/inventory/index.js';
import { reportRoutes } from './routes/reports/index.js';
import { paymentConfigRoutes } from './routes/payment-configs/index.js';
import { adminRoutes } from './routes/admin/index.js';
import { authMiddleware } from './middleware/auth.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ============================================================
// Global error handlers — prevent process crashes
// ============================================================

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  // Keep the process alive — do NOT exit
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
  // Keep the process alive — do NOT exit
});

// Graceful shutdown
let shuttingDown = false;
process.on('SIGTERM', async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[SHUTDOWN] SIGTERM received — closing server...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[SHUTDOWN] SIGINT received — closing server...');
  process.exit(0);
});

async function buildApp() {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // Plugins
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  // Health check (no auth — for uptime monitoring)
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Global error handler — catch all unhandled route errors
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
      statusCode,
    });
  });

  // Public routes (no auth required)
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Authenticated routes
  await app.register(async (api) => {
    // Auth middleware applied to all routes below
    api.addHook('onRequest', authMiddleware);

    await api.register(productRoutes, { prefix: '/api/products' });
    await api.register(orderRoutes, { prefix: '/api/orders' });
    await api.register(customerRoutes, { prefix: '/api/customers' });
    await api.register(commandRoutes, { prefix: '/api/commands' });
    await api.register(financeRoutes, { prefix: '/api/finance' });
    await api.register(tenantRoutes, { prefix: '/api/tenant' });
    await api.register(syncRoutes, { prefix: '/api/sync' });
    await api.register(categoriesRoutes, { prefix: '/api/categories' });
    await api.register(variationTemplateRoutes, { prefix: '/api/variation-templates' });
    await api.register(integrationRoutes, { prefix: '/api/integrations' });
    await api.register(supplierRoutes, { prefix: '/api/suppliers' });
    await api.register(purchaseRoutes, { prefix: '/api/purchases' });
    await api.register(inventoryRoutes, { prefix: '/api/inventory' });
    await api.register(reportRoutes, { prefix: '/api/reports' });
    await api.register(paymentConfigRoutes, { prefix: '/api/payment-configs' });
  });

  // SUPER_ADMIN routes (auth + SUPER_ADMIN check)
  await app.register(async (adminApi) => {
    adminApi.addHook('onRequest', authMiddleware);
    adminApi.addHook('onRequest', async (request, reply) => {
      if (request.userRole !== 'SUPER_ADMIN') {
        reply.status(403).send({ error: 'Acesso restrito ao administrador da plataforma.' });
      }
    });
    await adminApi.register(adminRoutes, { prefix: '/api/admin' });
  });

  return app;
}

// Start
const app = await buildApp();

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`🚀 Sale360 API running on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { buildApp };
