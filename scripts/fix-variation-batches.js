// Fix: create missing InventoryBatch records for variations that have stockQty but no batches
// Usage: node scripts/fix-variation-batches.js
const { PrismaClient } = require('../packages/db/generated/index.js');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Buscando variações com estoque órfão (sem lote)...\n');

  // Find all variations that have stockQty > 0 but no matching InventoryBatch
  const variations = await prisma.productVariation.findMany({
    where: {
      stockQty: { gt: 0 },
      batches: { none: {} },
    },
    include: {
      product: { select: { id: true, name: true, tenantId: true, costPrice: true } },
    },
  });

  if (variations.length === 0) {
    console.log('✅ Nenhuma variação órfã encontrada.');
    return;
  }

  console.log(`📦 ${variations.length} variações encontradas:\n`);

  let created = 0;
  for (const v of variations) {
    const stockQty = Number(v.stockQty);
    const tenantId = v.product.tenantId;
    const productId = v.product.id;

    console.log(`   ➕ ${v.product.name} / ${v.name} — estoque: ${stockQty}`);

    await prisma.$transaction(async (tx) => {
      // Create batch
      const batch = await tx.inventoryBatch.create({
        data: {
          tenantId,
          productId,
          variationId: v.id,
          quantity: stockQty,
          remainingQty: stockQty,
          unitCost: v.product.costPrice ? Number(v.product.costPrice) : 0,
          receivedAt: new Date(),
        },
      });

      // Create movement
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId,
          variationId: v.id,
          type: 'INITIAL_STOCK',
          quantity: stockQty,
          batchId: batch.id,
          notes: `Correção — estoque inicial da variação "${v.name}"`,
        },
      });

      // Increment product stock
      await tx.product.update({
        where: { id: productId },
        data: { stockQty: { increment: stockQty } },
      });
    });

    created++;
  }

  console.log(`\n✅ ${created} variações corrigidas.`);
}

main()
  .catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
