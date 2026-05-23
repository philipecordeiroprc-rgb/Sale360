import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
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
import { couponRoutes } from './routes/coupons/index.js';
import { indicatorRoutes } from './routes/indicators/index.js';
import { catalogSettingsRoutes } from './routes/catalog-settings/index.js';
import { publicRoutes } from './routes/public/index.js';
import { adminRoutes } from './routes/admin/index.js';
import { authMiddleware } from './middleware/auth.js';
import path from 'path';
import fsSync from 'fs';

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
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

  // Health check (no auth — for uptime monitoring)
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Serve uploaded files (logos, banners, products) — public
  const uploadDir = path.resolve(process.cwd(), '../uploads');
  const uploadSubdirs = ['logos', 'banners', 'products'];
  app.get('/api/public/uploads/*', async (request, reply) => {
    const requestedPath = (request.params as Record<string, string>)['*'] || '';
    // Prevent path traversal
    if (requestedPath.includes('..')) {
      return reply.status(400).send({ error: 'Invalid path' });
    }
    let filePath = path.resolve(uploadDir, requestedPath);
    if (!filePath.startsWith(path.resolve(uploadDir))) {
      return reply.status(400).send({ error: 'Invalid path' });
    }
    // Check if file exists; if not, try subdirectories (backward compat)
    try {
      await fsSync.promises.access(filePath);
    } catch {
      let found = false;
      for (const sub of uploadSubdirs) {
        const altPath = path.resolve(uploadDir, sub, path.basename(requestedPath));
        if (!altPath.startsWith(path.resolve(uploadDir))) continue;
        try {
          await fsSync.promises.access(altPath);
          filePath = altPath;
          found = true;
          break;
        } catch { /* keep trying */ }
      }
      if (!found) {
        return reply.status(404).send({ error: 'File not found' });
      }
    }
    const ext = path.extname(requestedPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    };
    reply.type(mimeTypes[ext] || 'application/octet-stream');
    return reply.send(fsSync.createReadStream(filePath));
  });

  // Global error handler — catch all unhandled route errors
  app.setErrorHandler((error: any, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? 'Erro interno do servidor' : error.message,
      statusCode,
    });
  });

  // Public routes (no auth required)
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(publicRoutes, { prefix: '/api/public' });

  // Authenticated routes
  await app.register(async (api) => {
    // Auth middleware applied to all routes below
    api.addHook('onRequest', authMiddleware);

    const registerSafe = async (plugin: any, opts: any) => {
      try {
        await api.register(plugin, opts);
      } catch (err: any) {
        app.log.error(`[ROUTE ERROR] Failed to register ${opts.prefix}:`, err?.message || err);
        // Route stays offline but server continues
      }
    };

    await registerSafe(productRoutes, { prefix: '/api/products' });
    await registerSafe(orderRoutes, { prefix: '/api/orders' });
    await registerSafe(customerRoutes, { prefix: '/api/customers' });
    await registerSafe(commandRoutes, { prefix: '/api/commands' });
    await registerSafe(financeRoutes, { prefix: '/api/finance' });
    await registerSafe(tenantRoutes, { prefix: '/api/tenant' });
    await registerSafe(syncRoutes, { prefix: '/api/sync' });
    await registerSafe(categoriesRoutes, { prefix: '/api/categories' });
    await registerSafe(variationTemplateRoutes, { prefix: '/api/variation-templates' });
    await registerSafe(integrationRoutes, { prefix: '/api/integrations' });
    await registerSafe(supplierRoutes, { prefix: '/api/suppliers' });
    await registerSafe(purchaseRoutes, { prefix: '/api/purchases' });
    await registerSafe(inventoryRoutes, { prefix: '/api/inventory' });
    await registerSafe(reportRoutes, { prefix: '/api/reports' });
    await registerSafe(paymentConfigRoutes, { prefix: '/api/payment-configs' });
    await registerSafe(catalogSettingsRoutes, { prefix: '/api/catalog-settings' });
    await registerSafe(couponRoutes, { prefix: '/api/coupons' });
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

// Start with retry (handles port-in-use, DB not ready, etc.)
async function start() {
  const app = await buildApp();

  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await app.listen({ port: PORT, host: HOST });
      console.log(`🚀 Sale360 API running on http://localhost:${PORT}`);
      return;
    } catch (err: any) {
      if (err.code === 'EADDRINUSE' && attempt < maxRetries) {
        console.error(`[STARTUP] Port ${PORT} in use — retrying (${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      app.log.error(err);
      if (attempt === maxRetries) {
        console.error('[STARTUP] Failed to start after retries. Exiting.');
        process.exit(1);
      }
    }
  }
}

start();

export { buildApp };
