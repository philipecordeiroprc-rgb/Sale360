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
import { authMiddleware } from './middleware/auth.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

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

  // Health check (no auth)
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Public routes (no auth required)
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Authenticated routes
  await app.register(async (authRoutes) => {
    // Auth middleware applied to all routes below
    authRoutes.addHook('onRequest', authMiddleware);

    await authRoutes.register(productRoutes, { prefix: '/api/products' });
    await authRoutes.register(orderRoutes, { prefix: '/api/orders' });
    await authRoutes.register(customerRoutes, { prefix: '/api/customers' });
    await authRoutes.register(commandRoutes, { prefix: '/api/commands' });
    await authRoutes.register(financeRoutes, { prefix: '/api/finance' });
    await authRoutes.register(tenantRoutes, { prefix: '/api/tenant' });
    await authRoutes.register(syncRoutes, { prefix: '/api/sync' });
    await authRoutes.register(integrationRoutes, { prefix: '/api/integrations' });
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
