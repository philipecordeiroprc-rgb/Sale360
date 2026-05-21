const fs = require('fs');
const file = 'C:/Users/rafac/Documents/GitHub/Sale360/packages/api/src/routes/orders/index.ts';
let content = fs.readFileSync(file, 'utf8');

// Fix the pay endpoint schema and transaction
const oldPay = `    const schema = z.object({
      paidAmount: z.number().optional(), // valor parcial (default: total)
    });
    const parsed = schema.safeParse(request.body || {});
    const paidAmount = parsed.success && parsed.data.paidAmount ? parsed.data.paidAmount : Number(order.total);
    const newPaymentStatus = paidAmount >= Number(order.total) ? 'PAID' : 'PARTIAL';

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: newPaymentStatus,
            paidAmount: { increment: paidAmount },
            ...(paymentMethod ? { paymentMethod: paymentMethod as string } : {}),
          },
        });`;

const newPay = `    const schema = z.object({
      paidAmount: z.number().optional(), // valor parcial (default: total)
      paymentMethod: z.string().optional(), // novo metodo de pagamento ao quitar fiado
    });
    const parsed = schema.safeParse(request.body || {});
    const paidAmount = parsed.success && parsed.data.paidAmount ? parsed.data.paidAmount : Number(order.total);
    const paymentMethod = parsed.success ? parsed.data.paymentMethod : undefined;
    const newPaymentStatus = paidAmount >= Number(order.total) ? 'PAID' : 'PARTIAL';

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: newPaymentStatus,
          paidAmount: { increment: paidAmount },
          ...(paymentMethod ? { paymentMethod: paymentMethod as string } : {}),
        },
      });`;

content = content.replace(oldPay, newPay);
fs.writeFileSync(file, content);
console.log('Pay endpoint fixed');
