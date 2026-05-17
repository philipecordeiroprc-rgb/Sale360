import { PrismaClient, Plan, Status, UserRole } from '../generated/index.js';

const prisma = new PrismaClient();

async function main() {
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

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: 'admin@sale360.app' },
    update: {},
    create: {
      email: 'admin@sale360.app',
      name: 'Admin Demo',
      password: '$2b$10$...', // bcrypt hash for "admin123"
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
        unit: 'UN',
        isFractional: true,
      },
    }),
  ]);

  console.log('Seed completed!');
  console.log(`  Tenant: demo (${tenant.id})`);
  console.log('  User: admin@sale360.app / admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
