import { prisma } from '@sale360/db';

async function cleanAll() {
  console.log('🧹 Limpando todos os dados...\n');

  // Delete in FK-safe order
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.inventoryMovement.deleteMany(),
    prisma.inventoryBatch.deleteMany(),
    prisma.purchaseItem.deleteMany(),
    prisma.purchase.deleteMany(),
    prisma.cashFlow.deleteMany(),
    prisma.creditTransaction.deleteMany(),
    prisma.productVariation.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.commissionItem.deleteMany(),
    prisma.delivery.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.variationDimension.deleteMany(),
    prisma.variationTemplate.deleteMany(),
  ]);

  console.log('✅ Todos os dados foram excluídos.');
  console.log('📝 Usuários e tenants preservados.');

  // Show remaining counts
  const counts: Record<string, number> = {};
  for (const model of [
    'order', 'inventoryBatch', 'purchase', 'product', 'category',
    'supplier', 'customer', 'cashFlow', 'productVariation'
  ] as const) {
    const count = await (prisma as any)[model].count();
    counts[model] = count;
  }
  console.log('\n📊 Registros restantes:');
  for (const [model, count] of Object.entries(counts)) {
    console.log(`  ${model}: ${count}`);
  }
}

cleanAll()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
