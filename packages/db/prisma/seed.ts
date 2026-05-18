import { PrismaClient, Plan, Status, UserRole, PlatformRole, DimensionType } from '../generated/index.js';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data (order matters: children first)
  await prisma.delivery.deleteMany();
  await prisma.cashFlow.deleteMany();
  await prisma.commandItem.deleteMany();
  await prisma.tableCommand.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.productVariation.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.tenantUser.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.device.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      companyName: 'Loja Demo Sale360',
      plan: Plan.GROW,
      status: Status.TRIAL,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Create SUPER_ADMIN (platform-level)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'super@sale360.app' },
    update: {},
    create: {
      email: 'super@sale360.app',
      name: 'Super Admin',
      password: '$2b$10$W19Ukgb092gf/xoZa83B9.bcRLR1b3eEGHXNls4o3DZEhZLcMoZ0i', // admin123
      role: PlatformRole.SUPER_ADMIN,
    },
  });

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'admin@sale360.app' },
    update: {},
    create: {
      email: 'admin@sale360.app',
      name: 'Admin Demo',
      password: '$2b$10$W19Ukgb092gf/xoZa83B9.bcRLR1b3eEGHXNls4o3DZEhZLcMoZ0i', // admin123
    },
  });

  // Link user to tenant
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: UserRole.OWNER,
      pin: '1234',
    },
  });

  // Create sample categories
  const categories = await Promise.all([
    prisma.category.create({
      data: { tenantId: tenant.id, name: 'Bebidas', color: '#3B82F6', sortOrder: 1 },
    }),
    prisma.category.create({
      data: { tenantId: tenant.id, name: 'Lanches', color: '#F59E0B', sortOrder: 2 },
    }),
    prisma.category.create({
      data: { tenantId: tenant.id, name: 'Sobremesas', color: '#EC4899', sortOrder: 3 },
    }),
  ]);

  // Create sample products
  await Promise.all([
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: categories[0].id,
        name: 'Coca-Cola 350ml',
        barcode: '7894900010015',
        price: 5.0,
        costPrice: 3.5,
        stockQty: 100,
        unit: 'UN',
        imageUrl: '/placeholder.png',
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: categories[0].id,
        name: 'Água Mineral 500ml',
        barcode: '7894900010016',
        price: 3.0,
        costPrice: 1.5,
        stockQty: 200,
        unit: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: categories[1].id,
        name: 'X-Burger',
        price: 18.0,
        costPrice: 8.0,
        stockQty: 0,
        unit: 'UN',
        isFractional: false,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: categories[1].id,
        name: 'X-Salada',
        price: 22.0,
        costPrice: 10.0,
        stockQty: 0,
        unit: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: categories[2].id,
        name: 'Açaí 300ml',
        price: 16.0,
        costPrice: 7.0,
        stockQty: 30,
        unit: 'ML',
        isFractional: true,
      },
    }),
  ]);

  // Create default variation templates
  const templates = await Promise.all([
    prisma.variationTemplate.create({
      data: {
        name: 'Vestuário Adulto',
        dimensions: {
          create: [
            { type: 'TAMANHO_LETRA', label: 'Tamanho', options: JSON.stringify(['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG']), orderIndex: 0 },
            { type: 'TAMANHO_NUMERO', label: 'Tamanho (Núm.)', options: JSON.stringify(['36','38','40','42','44','46','48','50','52','54','56']), orderIndex: 1 },
            { type: 'COR', label: 'Cor', options: JSON.stringify(['Vermelho','Azul','Verde','Preto','Branco','Amarelo','Rosa','Cinza','Marrom','Laranja','Roxo','Bege']), orderIndex: 2 },
          ],
        },
      },
    }),
    prisma.variationTemplate.create({
      data: {
        name: 'Vestuário Infantil',
        dimensions: {
          create: [
            { type: 'TAMANHO_NUMERO', label: 'Tamanho', options: JSON.stringify(['2','4','6','8','10','12','14','16','18','20']), orderIndex: 0 },
            { type: 'COR', label: 'Cor', options: JSON.stringify(['Vermelho','Azul','Verde','Preto','Branco','Amarelo','Rosa','Cinza','Marrom','Laranja','Roxo','Bege']), orderIndex: 1 },
          ],
        },
      },
    }),
    prisma.variationTemplate.create({
      data: {
        name: 'Calçados',
        dimensions: {
          create: [
            { type: 'TAMANHO_NUMERO', label: 'Tamanho', options: JSON.stringify(['33','34','35','36','37','38','39','40','41','42','43','44','45','46']), orderIndex: 0 },
            { type: 'COR', label: 'Cor', options: JSON.stringify(['Preto','Branco','Marrom','Azul Marinho','Bege','Vermelho']), orderIndex: 1 },
          ],
        },
      },
    }),
    prisma.variationTemplate.create({
      data: {
        name: 'Volume (Líquidos)',
        dimensions: {
          create: [
            { type: 'VOLUME', label: 'Volume', options: JSON.stringify(['100ml','200ml','250ml','300ml','350ml','500ml','600ml','750ml','1L','1.5L','2L','5L','10L','20L']), orderIndex: 0 },
          ],
        },
      },
    }),
    prisma.variationTemplate.create({
      data: {
        name: 'Peso (Granel/Alimentos)',
        dimensions: {
          create: [
            { type: 'PESO', label: 'Peso', options: JSON.stringify(['50g','100g','200g','250g','500g','750g','1kg','2kg','5kg','10kg','20kg','50kg']), orderIndex: 0 },
          ],
        },
      },
    }),
    prisma.variationTemplate.create({
      data: {
        name: 'Unidades (Geral)',
        dimensions: {
          create: [
            { type: 'PERSONALIZADO', label: 'Unidade', options: JSON.stringify(['UN','PC','CX','PAR','FD','PCT']), orderIndex: 0 },
          ],
        },
      },
    }),
  ]);

  console.log('Seed completed!');
  console.log(`  Tenant: demo (${tenant.id})`);
  console.log(`  Templates: ${templates.length} criados`);
  console.log('  User: admin@sale360.app / admin123 (ADMIN loja)');
  console.log('  Super Admin: super@sale360.app / admin123 (plataforma)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
