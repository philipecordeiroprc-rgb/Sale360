import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@sale360/db';
import { z } from 'zod';

const commandItemSchema = z.object({
  productId: z.string().optional(),
  productName: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number(),
  total: z.number(),
  notes: z.string().optional(),
});

const createCommandSchema = z.object({
  tableNumber: z.string(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z.array(commandItemSchema).optional(),
});

export const commandRoutes: FastifyPluginAsync = async (app) => {
  // List open commands
  app.get('/', async (request) => {
    const { status } = request.query as Record<string, string>;
    const where: any = { tenantId: request.tenantId };
    if (status) where.status = status;
    else where.status = 'OPEN';

    const commands = await prisma.tableCommand.findMany({
      where,
      include: { items: true },
      orderBy: { openedAt: 'desc' },
    });

    return commands;
  });

  // Get single command
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const command = await prisma.tableCommand.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { items: true },
    });
    if (!command) return reply.status(404).send({ error: 'Comanda não encontrada' });
    return command;
  });

  // Open new command
  app.post('/', async (request, reply) => {
    const parsed = createCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const { items, ...data } = parsed.data;

    const command = await prisma.tableCommand.create({
      data: {
        ...data,
        tenantId: request.tenantId,
        items: items
          ? { create: items }
          : undefined,
      },
      include: { items: true },
    });

    return reply.status(201).send(command);
  });

  // Add item to command
  app.post('/:id/items', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = commandItemSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });

    const command = await prisma.tableCommand.findFirst({
      where: { id, tenantId: request.tenantId, status: 'OPEN' },
    });
    if (!command) return reply.status(404).send({ error: 'Comanda não encontrada ou já fechada' });

    const item = await prisma.commandItem.create({
      data: { ...parsed.data, commandId: id },
    });

    // Update command totals
    const items = await prisma.commandItem.findMany({ where: { commandId: id } });
    const subtotal = items.reduce((s, i) => s + Number(i.total), 0);

    await prisma.tableCommand.update({
      where: { id },
      data: { subtotal, total: subtotal - Number(command.discount) },
    });

    return reply.status(201).send(item);
  });

  // Remove item from command
  app.delete('/:commandId/items/:itemId', async (request, reply) => {
    const { commandId, itemId } = request.params as { commandId: string; itemId: string };

    const command = await prisma.tableCommand.findFirst({
      where: { id: commandId, tenantId: request.tenantId, status: 'OPEN' },
    });
    if (!command) return reply.status(404).send({ error: 'Comanda não encontrada ou já fechada' });

    await prisma.commandItem.delete({ where: { id: itemId } });

    // Recalculate totals
    const items = await prisma.commandItem.findMany({ where: { commandId } });
    const subtotal = items.reduce((s, i) => s + Number(i.total), 0);

    await prisma.tableCommand.update({
      where: { id: commandId },
      data: { subtotal, total: subtotal - Number(command.discount) },
    });

    return { success: true };
  });

  // Close command (convert to order)
  app.post('/:id/close', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      paymentMethod: z.string().optional(),
      payments: z.array(z.object({
        paymentMethod: z.string().min(1),
        amount: z.number().positive(),
      })).optional(),
      discount: z.number().default(0),
      paymentReceived: z.number().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Dados inválidos' });

    const command = await prisma.tableCommand.findFirst({
      where: { id, tenantId: request.tenantId, status: 'OPEN' },
      include: { items: true },
    });
    if (!command) return reply.status(404).send({ error: 'Comanda não encontrada ou já fechada' });

    const total = Number(command.subtotal) - (parsed.success ? parsed.data.discount : 0);

    // Build effective payments
    let cmdEffectivePayments: Array<{ paymentMethod: string; amount: number }> = [];
    if (parsed.data.payments && parsed.data.payments.length > 0) {
      cmdEffectivePayments = parsed.data.payments;
    } else if (parsed.data.paymentMethod) {
      cmdEffectivePayments = [{ paymentMethod: parsed.data.paymentMethod, amount: total }];
    } else {
      return reply.status(400).send({ error: 'paymentMethod ou payments é obrigatório' });
    }
    const cmdPrimaryMethod = cmdEffectivePayments[0].paymentMethod;

    // Create order from command
    const lastOrder = await prisma.order.findFirst({
      where: { tenantId: request.tenantId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber || 0) + 1;

    await prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          tenantId: request.tenantId,
          userId: request.userId,
          orderNumber,
          source: 'COMAND',
          subtotal: command.subtotal,
          discount: parsed.data.discount,
          total,
          paidAmount: parsed.data.paymentReceived || total,
          paymentMethod: cmdPrimaryMethod,
          paymentStatus: parsed.data.paymentReceived && parsed.data.paymentReceived < total ? 'PARTIAL' : 'PAID',
          notes: `Comanda mesa ${command.tableNumber}`,
          items: {
            create: command.items.map((item) => ({
              productId: item.productId || undefined,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        },
      });

      // Create OrderPayment records
      for (const payment of cmdEffectivePayments) {
        await tx.orderPayment.create({
          data: {
            orderId: order.id,
            paymentMethod: payment.paymentMethod,
            amount: payment.amount,
          },
        });
      }

      // Close command
      await tx.tableCommand.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          discount: parsed.data.discount,
          total,
          paymentMethod: parsed.data.paymentMethod,
          paymentReceived: parsed.data.paymentReceived,
        },
      });

      // Cash flow
      await tx.cashFlow.create({
        data: {
          tenantId: request.tenantId,
          type: 'IN',
          category: 'venda',
          description: `Comanda mesa ${command.tableNumber}`,
          amount: total,
          dueDate: new Date(),
          paidAt: new Date(),
        },
      });
    });

    return { success: true, total };
  });
};
