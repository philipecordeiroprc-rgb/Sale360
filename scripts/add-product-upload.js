const fs = require('fs');
const filePath = 'C:/Users/rafac/Documents/GitHub/Sale360/packages/api/src/routes/products/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find the delete endpoint's return statement and add the upload endpoint after it
const oldText = `    await prisma.product.delete({ where: { id } });

    return { success: true };
  });

  // Bulk import (for migration / import from other systems)`;

const newText = `    await prisma.product.delete({ where: { id } });

    return { success: true };
  });

  // Upload product image
  const uploadDir = path.resolve(process.cwd(), '../uploads');
  const productsDir = path.join(uploadDir, 'products');

  app.post('/:id/image', async (request, reply) => {
    const { id } = request.params as { id: string };

    const product = await prisma.product.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' });

    const file = await request.file();
    if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado' });

    const ext = path.extname(file.filename).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      return reply.status(400).send({ error: 'Formato inválido. Use JPG, PNG ou WebP.' });
    }

    await fs.mkdir(productsDir, { recursive: true });

    const filename = \`\${request.tenantId}_\${id}_\${Date.now()}\${ext}\`;
    const filepath = path.join(productsDir, filename);

    await fs.writeFile(filepath, await file.toBuffer());

    // Remove old image if exists
    if (product.imageUrl) {
      const oldPath = path.join(uploadDir, product.imageUrl);
      fs.unlink(oldPath).catch(() => {});
    }

    const imageUrl = \`products/\${filename}\`;
    await prisma.product.update({
      where: { id },
      data: { imageUrl },
    });

    return { imageUrl };
  });

  // Bulk import (for migration / import from other systems)`;

if (content.includes(oldText)) {
  content = content.replace(oldText, newText);
  console.log('Product image upload endpoint added');
} else {
  console.log('Target text not found - searching for alternatives...');

  // Check if it was already added
  if (content.includes("app.post('/:id/image'")) {
    console.log('Endpoint already exists');
  } else {
    console.log('ERROR: Could not find insertion point');
    // Output the area around where we expect the delete
    const idx = content.indexOf('product.delete');
    if (idx >= 0) {
      console.log('Found at index:', idx);
      console.log('Context:', content.substring(idx, idx + 200));
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');
