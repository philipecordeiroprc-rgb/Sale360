/**
 * One-off script: merge duplicate variations (same productId + same name).
 * Run: node packages/api/scripts/merge-duplicate-variations.mjs
 */
import { PrismaClient } from './generated/index.js';
import { createInterface } from 'readline';

const prisma = new PrismaClient();

async function main() {
  console.log('Finding duplicate variations...\n');

  const allVariations = await prisma.productVariation.findMany({
    include: { product: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Group by productId + normalized name
  const groups = new Map();
  for (const v of allVariations) {
    const key = `${v.productId}__${v.name.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(v);
  }

  const duplicates = Array.from(groups.values()).filter(g => g.length > 1);

  if (duplicates.length === 0) {
    console.log('No duplicate variations found.');
    process.exit(0);
  }

  console.log(`Found ${duplicates.length} duplicate groups:\n`);
  for (const group of duplicates) {
    console.log(`  Product: ${group[0].product?.name || 'N/A'}`);
    console.log(`  Variation: "${group[0].name}"`);
    for (const v of group) {
      const batchCount = await prisma.inventoryBatch.count({ where: { variationId: v.id } });
      const movementCount = await prisma.inventoryMovement.count({ where: { variationId: v.id } });
      console.log(`    ${v.id} (stock: ${v.stockQty}, batches: ${batchCount}, movements: ${movementCount})`);
    }
    console.log();
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => {
    rl.question('Merge duplicates? Keep oldest, update all refs. (y/N): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  let totalMerged = 0;

  for (const group of duplicates) {
    const canonical = group[0];
    const toMerge = group.slice(1);

    console.log(`\nMerging "${canonical.name}" → canonical ${canonical.id}...`);

    for (const dup of toMerge) {
      console.log(`  ${dup.id} → ${canonical.id}`);

      await prisma.$transaction(async (tx) => {
        const b = await tx.inventoryBatch.updateMany({
          where: { variationId: dup.id },
          data: { variationId: canonical.id },
        });
        console.log(`    Batches: ${b.count}`);

        const m = await tx.inventoryMovement.updateMany({
          where: { variationId: dup.id },
          data: { variationId: canonical.id },
        });
        console.log(`    Movements: ${m.count}`);

        const pi = await tx.purchaseItem.updateMany({
          where: { variationId: dup.id },
          data: { variationId: canonical.id },
        });
        console.log(`    PurchaseItems: ${pi.count}`);

        const oi = await tx.orderItem.updateMany({
          where: { variationId: dup.id },
          data: { variationId: canonical.id },
        });
        console.log(`    OrderItems: ${oi.count}`);

        if (Number(dup.stockQty) > 0) {
          await tx.productVariation.update({
            where: { id: canonical.id },
            data: { stockQty: { increment: Number(dup.stockQty) } },
          });
          console.log(`    Stock: +${dup.stockQty}`);
        }

        await tx.productVariation.delete({ where: { id: dup.id } });
        console.log(`    Deleted.`);
      });

      totalMerged++;
    }
  }

  console.log(`\nDone! Merged ${totalMerged} duplicates.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
