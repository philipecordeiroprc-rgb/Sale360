import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';

const updateSchema = z.object({
  storeName: z.string().optional(),
  storePhone: z.string().optional(),
  document: z.string().optional(),
  companyName: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  displayMode: z.enum(['grid', 'list']).optional(),
  outOfStockBehavior: z.enum(['hide', 'show_disabled', 'show']).optional(),
  acceptOrders: z.boolean().optional(),
  receiveWhatsApp: z.boolean().optional(),
  whatsAppNumber: z.string().optional(),
  postOrderMessage: z.string().optional(),
  instagram: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  aboutUs: z.string().optional(),
  active: z.boolean().optional(),
});

function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== null),
  );
}

const paymentMethodsSchema = z.object({
  methods: z.array(z.object({
    paymentMethod: z.enum(['pix', 'cash', 'credit', 'debit', 'credit_store', 'meal_voucher', 'food_voucher']),
    enabled: z.boolean(),
    dueDays: z.number().int().positive().nullable().optional(),
    instructions: z.string().nullable().optional(),
  })),
});

const uploadDir = path.resolve(process.cwd(), '../uploads');
const logosDir = path.join(uploadDir, 'logos');
const bannersDir = path.join(uploadDir, 'banners');

async function ensureDirs() {
  await fs.mkdir(logosDir, { recursive: true });
  await fs.mkdir(bannersDir, { recursive: true });
}

export const catalogSettingsRoutes: FastifyPluginAsync = async (app) => {
  await ensureDirs();

  const DEFAULT_PAYMENT_METHODS = [
    { paymentMethod: 'debit', enabled: true, dueDays: null as number | null, instructions: '' },
    { paymentMethod: 'credit', enabled: true, dueDays: null, instructions: '' },
    { paymentMethod: 'pix', enabled: true, dueDays: null, instructions: '' },
    { paymentMethod: 'cash', enabled: true, dueDays: null, instructions: '' },
    { paymentMethod: 'food_voucher', enabled: false, dueDays: null, instructions: '' },
    { paymentMethod: 'meal_voucher', enabled: false, dueDays: null, instructions: '' },
    { paymentMethod: 'credit_store', enabled: false, dueDays: 30, instructions: '' },
  ] as const;

  // GET settings (lazy create)
  app.get('/', async (request) => {
    let settings = await prisma.catalogSettings.findUnique({
      where: { tenantId: request.tenantId },
      include: {
        banners: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
        paymentMethods: true,
      },
    });

    if (!settings) {
      settings = await prisma.catalogSettings.create({
        data: { tenantId: request.tenantId },
        include: {
          banners: true,
          paymentMethods: true,
        },
      });
    }

    // Garante que todos os meios de pagamento existam (novos métodos adicionados em updates)
    if (settings.paymentMethods.length < DEFAULT_PAYMENT_METHODS.length) {
      const existingMethods = new Set(settings.paymentMethods.map((pm) => pm.paymentMethod));
      const missing = DEFAULT_PAYMENT_METHODS.filter((d) => !existingMethods.has(d.paymentMethod));
      if (missing.length > 0) {
        await Promise.all(
          missing.map((m) =>
            prisma.catalogPaymentMethod.create({
              data: {
                catalogId: settings!.id,
                paymentMethod: m.paymentMethod,
                enabled: m.enabled,
                dueDays: m.dueDays ?? undefined,
                instructions: m.instructions,
              },
            })
          )
        );
        // Reload to include the new methods
        settings = await prisma.catalogSettings.findUnique({
          where: { tenantId: request.tenantId },
          include: {
            banners: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
            paymentMethods: true,
          },
        })!;
      }
    }

    // Ordena métodos de pagamento na ordem esperada pelo frontend
    const order = DEFAULT_PAYMENT_METHODS.map((d) => d.paymentMethod);
    settings.paymentMethods.sort(
      (a, b) => order.indexOf(a.paymentMethod) - order.indexOf(b.paymentMethod)
    );

    return settings;
  });

  // PUT settings
  app.put('/', async (request, reply) => {
    const parsed = updateSchema.safeParse(stripNulls(request.body as Record<string, unknown>));
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const settings = await prisma.catalogSettings.upsert({
      where: { tenantId: request.tenantId },
      create: { tenantId: request.tenantId, ...parsed.data },
      update: parsed.data,
      include: {
        banners: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
        paymentMethods: true,
      },
    });

    return settings;
  });

  // POST logo upload
  app.post('/logo', async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });

    const ext = path.extname(file.filename).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return reply.status(400).send({ error: 'Formato inválido. Use JPG, PNG ou WebP.' });
    }

    const filename = `${request.tenantId}_${Date.now()}${ext}`;
    const filepath = path.join(logosDir, filename);

    await fs.writeFile(filepath, await file.toBuffer());

    // Remove old logo if exists
    const current = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });
    if (current?.logoPath) {
      const oldPath = path.join(uploadDir, current.logoPath);
      fs.unlink(oldPath).catch(() => {});
    }

    const logoPath = `logos/${filename}`;
    await prisma.catalogSettings.upsert({
      where: { tenantId: request.tenantId },
      create: { tenantId: request.tenantId, logoPath },
      update: { logoPath },
    });

    return { logoPath };
  });

  // POST banner upload
  app.post('/banners', async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });

    const ext = path.extname(file.filename).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      return reply.status(400).send({ error: 'Formato inválido. Use JPG ou PNG.' });
    }

    const filename = `${request.tenantId}_${Date.now()}${ext}`;
    const filepath = path.join(bannersDir, filename);
    await fs.writeFile(filepath, await file.toBuffer());

    // Get linkUrl from fields (multipart fields come separately)
    // We'll read it from the query or just save without linkUrl for now
    const catalog = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });
    if (!catalog) {
      await prisma.catalogSettings.create({ data: { tenantId: request.tenantId } });
    }

    const existing = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });

    const maxSort = await prisma.catalogBanner.aggregate({
      where: { catalogId: existing!.id },
      _max: { sortOrder: true },
    });

    const bannerPath = `banners/${filename}`;
    const banner = await prisma.catalogBanner.create({
      data: {
        catalogId: existing!.id,
        imagePath: bannerPath,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    return banner;
  });

  // DELETE banner
  app.delete('/banners/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const banner = await prisma.catalogBanner.findFirst({
      where: {
        id,
        catalog: { tenantId: request.tenantId },
      },
    });

    if (!banner) return reply.status(404).send({ error: 'Banner não encontrado' });

    // Delete file
    const filepath = path.join(uploadDir, banner.imagePath);
    fs.unlink(filepath).catch(() => {});

    await prisma.catalogBanner.delete({ where: { id } });
    return { success: true };
  });

  // PUT banners reorder
  app.put('/banners/reorder', async (request, reply) => {
    const schema = z.object({ bannerIds: z.array(z.string()) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'bannerIds deve ser um array de strings' });
    }

    const catalog = await prisma.catalogSettings.findUnique({ where: { tenantId: request.tenantId } });
    if (!catalog) return reply.status(404).send({ error: 'Catálogo não encontrado' });

    // Update sortOrder for each banner
    await Promise.all(
      parsed.data.bannerIds.map((id, idx) =>
        prisma.catalogBanner.updateMany({
          where: { id, catalogId: catalog.id },
          data: { sortOrder: idx },
        })
      )
    );

    return { success: true };
  });

  // PUT payment methods
  app.put('/payment-methods', async (request, reply) => {
    const parsed = paymentMethodsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const catalog = await prisma.catalogSettings.upsert({
      where: { tenantId: request.tenantId },
      create: { tenantId: request.tenantId },
      update: {},
    });

    // Upsert each payment method
    const results = await Promise.all(
      parsed.data.methods.map((m) =>
        prisma.catalogPaymentMethod.upsert({
          where: {
            catalogId_paymentMethod: {
              catalogId: catalog.id,
              paymentMethod: m.paymentMethod,
            },
          },
          create: {
            catalogId: catalog.id,
            paymentMethod: m.paymentMethod,
            enabled: m.enabled,
            dueDays: m.dueDays,
            instructions: m.instructions,
          },
          update: {
            enabled: m.enabled,
            dueDays: m.dueDays,
            instructions: m.instructions,
          },
        })
      )
    );

    return results;
  });
};
