/**
 * One-off script: merge duplicate variations (same productId + same name).
 *
 * Run on server: cd packages/api && npx ts-node scripts/merge-duplicate-variations.ts
 */
import { prisma } from '@sale360/db';

async function main() {
  console.log('🔍 Finding duplicate variations...');

  // Get all variations grouped by productId + lowercased name
  const allVariations = await prisma.productVariation.findMany({
    include: { product: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Group by productId + normalized name
  const groups = new Map<string, typeof allVariations>();
  for (const v of allVariations) {
    const key = `${v.productId}__${v.name.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }

  const duplicates = Array.from(groups.values()).filter(g => g.length > 1);

  if (duplicates.length === 0) {
    console.log('✅ No duplicate variations found.');
    return;
  }

  console.log(`Found ${duplicates.length} duplicate groups:\n`);
  for (const group of duplicates) {
    console.log(`  Product: ${group[0].product?.name || 'N/A'}`);
    console.log(`  Variation name: "${group[0].name}"`);
    for (const v of group) {
      const batchCount = await prisma.inventoryBatch.count({ where: { variationId: v.id } });
      const movementCount = await prisma.inventoryMovement.count({ where: { variationId: v.id } });
      console.log(`    - ${v.id} (stock: ${v.stockQty}, batches: ${batchCount}, movements: ${movementCount})`);
    }
    console.log();
  }

  // Confirm
  const readline = (await import('readline')).default;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>(resolve => {
    rl.question('Merge duplicates? Keep oldest variation, update all references. (y/N): ', resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.');
    return;
  }

  let totalMerged = 0;

  for (const group of duplicates) {
    // Keep the first (oldest), merge rest into it
    const canonical = group[0];
    const toMerge = group.slice(1);

    console.log(`\nMerging "${canonical.name}" for product ${canonical.product?.name || canonical.productId}...`);
    console.log(`  Canonical: ${canonical.id} (stock: ${canonical.stockQty})`);

    for (const dup of toMerge) {
      console.log(`  Merging ${dup.id} (stock: ${dup.stockQty}) → ${canonical.id}`);

      await prisma.$transaction(async (tx) => {
        // Update batches
        const batchResult = await tx.inventoryBatch.updateMany({
          where: { variationId: dup.id },
          data: { variationId: canonical.id },
        });
        console.log(`    Batches updated: ${batchResult.count}`);

        // Update movements
        const movResult = await tx.inventoryMovement.updateMany({
          where: { variationId: dup.id },
          data: { variationId: canonical.id },
        });
        console.log(`    Movements updated: ${movResult.count}`);

        // Update purchase items
        const piResult = await tx.purchaseItem.updateMany({
          where: { variationId: dup.id },
          data: { variationId: canonical.id },
        });
        console.log(`    PurchaseItems updated: ${piResult.count}`);

        // Update order items (if any reference variationId)
        const oiResult = await tx.orderItem.updateMany({
          where: { variationId: dup.id },
          data: { variationId: canonical.id },
        });
        console.log(`    OrderItems updated: ${oiResult.count}`);

        // Sum stock into canonical
        if (Number(dup.stockQty) > 0) {
          await tx.productVariation.update({
            where: { id: canonical.id },
            data: { stockQty: { increment: Number(dup.stockQty) } },
          });
          console.log(`    Stock transferred: ${dup.stockQty}`);
        }

        // Delete the duplicate
        await tx.productVariation.delete({ where: { id: dup.id } });
        console.log(`    Deleted duplicate: ${dup.id}`);
      });

      totalMerged++;
    }
  }

  console.log(`\n✅ Done! Merged ${totalMerged} duplicate variations.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
