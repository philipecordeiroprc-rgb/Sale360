import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  // Get current tenant info
  app.get('/me', async (request) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenantId },
      include: {
        users: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: {
            products: true,
            orders: true,
            customers: true,
          },
        },
      },
    });

    return tenant;
  });

  // Plan features (what current tenant has access to)
  app.get('/features', async (request) => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: request.tenantId },
      select: { plan: true, status: true },
    });

    if (!tenant) return { error: 'Not found' };

    const features = {
      PRO: {
        maxUsers: 1,
        maxDevices: 1,
        webVersion: false,
        aiDescriptions: false,
        aiAssistant: false,
        magicRegister: false,
        variations: false,
        bulkImport: false,
        suppliers: false,
        recurrentExpenses: false,
        unlimitedUsers: false,
        prioritySupport: false,
        saturday: false,
        videoCall: false,
        whatsappSupport: false,
      },
      GROW: {
        maxUsers: 10,
        maxDevices: 5,
        webVersion: true,
        aiDescriptions: true,
        aiAssistant: false,
        magicRegister: false,
        variations: true,
        bulkImport: true,
        suppliers: true,
        recurrentExpenses: true,
        unlimitedUsers: false,
        prioritySupport: false,
        saturday: false,
        videoCall: false,
        whatsappSupport: false,
      },
      PRIME: {
        maxUsers: Infinity,
        maxDevices: Infinity,
        webVersion: true,
        aiDescriptions: true,
        aiAssistant: true,
        magicRegister: true,
        variations: true,
        bulkImport: true,
        suppliers: true,
        recurrentExpenses: true,
        unlimitedUsers: true,
        prioritySupport: true,
        saturday: true,
        videoCall: true,
        whatsappSupport: true,
      },
    };

    return {
      plan: tenant.plan,
      status: tenant.status,
      features: features[tenant.plan],
    };
  });

  // Users management
  app.get('/users', async (request) => {
    const users = await prisma.tenantUser.findMany({
      where: { tenantId: request.tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return users;
  });

  // Devices list
  app.get('/devices', async (request) => {
    const devices = await prisma.device.findMany({
      where: { tenantId: request.tenantId },
      orderBy: { lastSyncAt: 'desc' },
    });
    return devices;
  });
};
