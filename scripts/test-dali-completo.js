// Teste completo — Dali da Roça
// Uso: node scripts/test-dali-completo.js

const API = 'http://137.131.193.203:3001/api';
const EMAIL = 'philipecordeiroprc@gmail.com';
const PASSWORD = 'admin123';

async function api(path, options = {}) {
  const url = API + path;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    console.log(`  ⚠️  ${options.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(data).substring(0, 120)}`);
  }
  return { ok: res.ok, status: res.status, data };
}

let token = '';
let tenantId = '';
let createdUsers = [];
let createdCategories = [];
let createdTemplates = [];
let createdSuppliers = [];
let createdProducts = [];
let createdPurchases = [];
let createdOrders = [];

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  TESTE COMPLETO — DALI DA ROÇA           ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // =========================================================
  // 1. LOGIN
  // =========================================================
  console.log('━━━ 1. LOGIN ━━━');
  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) { console.log('❌ LOGIN FALHOU'); process.exit(1); }
  token = login.data.token;
  console.log('✅ Login:', login.data.user.email, '| Role:', login.data.user.role);

  // =========================================================
  // 2. GET TENANT (Dali da Roça)
  // =========================================================
  console.log('\n━━━ 2. IDENTIFICAR LOJA ━━━');
  const tenants = await api('/tenants');
  const dali = tenants.data?.tenants?.find(t => t.slug === 'dali-da-roca');
  if (!dali) { console.log('❌ Dali da Roça não encontrada!'); process.exit(1); }
  tenantId = dali.id;
  console.log('✅ Loja:', dali.companyName, '| Slug:', dali.slug, '| ID:', tenantId);

  // =========================================================
  // 3. CRIAR USUÁRIOS (Vendedor + Administrador da loja)
  // =========================================================
  console.log('\n━━━ 3. CRIAR USUÁRIOS ━━━');

  // 3a. Vendedor
  const sellerResp = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'João Vendedor',
      email: 'joao.vendedor@dali.com',
      password: 'vendedor123',
    }),
  });
  if (sellerResp.ok) {
    createdUsers.push(sellerResp.data.user);
    console.log('✅ Vendedor criado:', sellerResp.data.user.email, '| ID:', sellerResp.data.user.id);
  } else {
    console.log('⚠️  Vendedor já existe ou erro:', sellerResp.data.error);
  }

  // 3b. Administrador da loja
  const adminResp = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Maria Admin',
      email: 'maria.admin@dali.com',
      password: 'admin123',
    }),
  });
  if (adminResp.ok) {
    createdUsers.push(adminResp.data.user);
    console.log('✅ Admin loja criado:', adminResp.data.user.email, '| ID:', adminResp.data.user.id);
  } else {
    console.log('⚠️  Admin loja já existe ou erro:', adminResp.data.error);
  }

  // 3c. Associar ao tenant (aceitar convite ou add direto)
  for (const user of createdUsers) {
    // Add user to tenant directly as SUPER_ADMIN
    const addResp = await api('/admin/tenant-users', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: tenantId,
        userId: user.id,
        role: user.email.includes('admin') ? 'ADMIN' : 'USER',
      }),
    });
    if (addResp.ok) {
      console.log('✅ Associado à loja:', user.email);
    } else {
      console.log('   ⚠️  Associar:', addResp.data.error || addResp.data.message || 'ok');
    }
  }

  // =========================================================
  // 4. LOGIN COMO OS NOVOS USUÁRIOS
  // =========================================================
  console.log('\n━━━ 4. LOGIN COM NOVOS USUÁRIOS ━━━');

  // 4a. Login vendedor
  const sellerLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'joao.vendedor@dali.com', password: 'vendedor123' }),
  });
  if (sellerLogin.ok) {
    console.log('✅ Login vendedor OK:', sellerLogin.data.user.email, '| Role:', sellerLogin.data.user.role);
  } else {
    console.log('❌ Login vendedor falhou:', sellerLogin.data.error);
  }

  // 4b. Login admin loja
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'maria.admin@dali.com', password: 'admin123' }),
  });
  if (adminLogin.ok) {
    console.log('✅ Login admin loja OK:', adminLogin.data.user.email, '| Role:', adminLogin.data.user.role);
  } else {
    console.log('❌ Login admin loja falhou:', adminLogin.data.error);
  }

  // 4c. Forgot password flow
  const forgotResp = await api('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'joao.vendedor@dali.com' }),
  });
  console.log(forgotResp.ok ? '✅ Forgot password enviado' : '⚠️  Forgot password:', forgotResp.data.error || forgotResp.data.message);

  // =========================================================
  // 5. CRIAR TEMPLATES DE VARIAÇÃO
  // =========================================================
  console.log('\n━━━ 5. TEMPLATES DE VARIAÇÃO ━━━');

  const templates = [
    { name: 'Tamanho (Roupas)', dimensions: [{ type: 'SIZE', label: 'Tamanho', options: JSON.stringify(['PP','P','M','G','GG']) }] },
    { name: 'Cor + Tamanho', dimensions: [
      { type: 'COLOR', label: 'Cor', options: JSON.stringify(['Vermelho','Azul','Preto','Branco']) },
      { type: 'SIZE', label: 'Tamanho', options: JSON.stringify(['P','M','G']) },
    ]},
  ];

  for (const tpl of templates) {
    const resp = await api('/variation-templates', {
      method: 'POST',
      body: JSON.stringify({ ...tpl, tenantId }),
    });
    if (resp.ok) {
      createdTemplates.push(resp.data);
      console.log('✅ Template:', tpl.name, '| ID:', resp.data.id);
    } else {
      console.log('⚠️  Template:', resp.data.error);
    }
  }

  // =========================================================
  // 6. CRIAR CATEGORIAS
  // =========================================================
  console.log('\n━━━ 6. CATEGORIAS ━━━');

  const categories = [
    { name: 'Bebidas', color: '#3B82F6' },
    { name: 'Roupas', color: '#EF4444', variationTemplateId: createdTemplates[0]?.id },
    { name: 'Alimentos', color: '#10B981' },
    { name: 'Acessórios', color: '#F59E0B', variationTemplateId: createdTemplates[0]?.id },
  ];

  for (const cat of categories) {
    const resp = await api('/categories', {
      method: 'POST',
      body: JSON.stringify({ ...cat, tenantId }),
    });
    if (resp.ok) {
      createdCategories.push(resp.data);
      console.log('✅ Categoria:', cat.name, '| ID:', resp.data.id);
    } else {
      console.log('⚠️  Categoria:', resp.data.error);
    }
  }

  // =========================================================
  // 7. CRIAR FORNECEDORES
  // =========================================================
  console.log('\n━━━ 7. FORNECEDORES ━━━');

  const suppliers = [
    { name: 'Distribuidora de Bebidas LTDA', cnpj: '11.222.333/0001-44', phone: '(11) 99999-0001', email: 'contato@distribebidas.com' },
    { name: 'Confecção Moda Total', cnpj: '22.333.444/0001-55', phone: '(11) 99999-0002', email: 'vendas@modatotal.com' },
    { name: 'Atacadão Alimentos', cnpj: '33.444.555/0001-66', phone: '(11) 99999-0003', email: 'atacado@atacadao.com' },
  ];

  for (const sup of suppliers) {
    const resp = await api('/suppliers', {
      method: 'POST',
      body: JSON.stringify({ ...sup, tenantId }),
    });
    if (resp.ok) {
      createdSuppliers.push(resp.data);
      console.log('✅ Fornecedor:', sup.name, '| ID:', resp.data.id);
    } else {
      console.log('⚠️  Fornecedor:', resp.data.error);
    }
  }

  // =========================================================
  // 8. CRIAR PRODUTOS (Simples + Com Variação)
  // =========================================================
  console.log('\n━━━ 8. PRODUTOS ━━━');

  // 8a. Produtos simples
  const simpleProducts = [
    { name: 'Água Mineral 500ml', categoryId: createdCategories[0]?.id, price: 3.50, costPrice: 2.00, stockQty: 100, unit: 'UN', barcode: '7891000100001', sku: 'AGUA-500' },
    { name: 'Arroz 5kg', categoryId: createdCategories[2]?.id, price: 25.90, costPrice: 18.00, stockQty: 50, unit: 'UN', barcode: '7891000100002', sku: 'ARROZ-5KG' },
    { name: 'Feijão 1kg', categoryId: createdCategories[2]?.id, price: 8.90, costPrice: 5.50, stockQty: 80, unit: 'UN', barcode: '7891000100003', sku: 'FEIJAO-1KG' },
    { name: 'Boné Trucker', categoryId: createdCategories[3]?.id, price: 49.90, costPrice: 25.00, stockQty: 30, unit: 'UN', barcode: '7891000100004', sku: 'BONE-TRUCK' },
  ];

  for (const prod of simpleProducts) {
    const resp = await api('/products', {
      method: 'POST',
      body: JSON.stringify({ ...prod, tenantId }),
    });
    if (resp.ok) {
      createdProducts.push(resp.data);
      console.log('✅ Produto simples:', prod.name, '| R$', prod.price, '| Estoque:', prod.stockQty);
    } else {
      console.log('⚠️  Produto:', prod.name, '-', resp.data.error);
    }
  }

  // 8b. Produtos com variação
  if (createdTemplates.length > 0) {
    const variationProducts = [
      {
        name: 'Camiseta Basic',
        categoryId: createdCategories[1]?.id,
        price: 79.90,
        costPrice: 35.00,
        unit: 'UN',
        variations: [
          { name: 'P', sku: 'CAM-BASIC-P', barcode: '7891000200001', price: 79.90, stockQty: 20 },
          { name: 'M', sku: 'CAM-BASIC-M', barcode: '7891000200002', price: 79.90, stockQty: 30 },
          { name: 'G', sku: 'CAM-BASIC-G', barcode: '7891000200003', price: 79.90, stockQty: 25 },
          { name: 'GG', sku: 'CAM-BASIC-GG', barcode: '7891000200004', price: 84.90, stockQty: 15 },
        ],
      },
    ];

    for (const vprod of variationProducts) {
      const resp = await api('/products', {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          name: vprod.name,
          categoryId: vprod.categoryId,
          unit: vprod.unit,
          variations: vprod.variations.map(v => ({
            ...v,
            price: v.price,
          })),
        }),
      });
      if (resp.ok) {
        createdProducts.push(resp.data);
        console.log('✅ Produto c/ variações:', vprod.name, '|', vprod.variations.length, 'variações');
      } else {
        console.log('⚠️  Produto variação:', vprod.name, '-', resp.data.error);
      }
    }
  }

  // =========================================================
  // 9. CRIAR COMPRAS
  // =========================================================
  console.log('\n━━━ 9. COMPRAS ━━━');

  if (createdSuppliers.length > 0 && createdProducts.length > 0) {
    // Compra 1: Bebidas (DRAFT - não entra no estoque)
    const purchase1Resp = await api('/purchases', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        supplierId: createdSuppliers[0]?.id,
        status: 'RECEIVED',
        items: [
          { productId: createdProducts[0]?.id, productName: createdProducts[0]?.name, quantity: 50, unitCost: 1.80, total: 90.00 },
        ],
      }),
    });
    if (purchase1Resp.ok) {
      createdPurchases.push(purchase1Resp.data);
      console.log('✅ Compra #1 (Bebidas, RECEIVED):', purchase1Resp.data.items?.length, 'itens');
    } else {
      console.log('⚠️  Compra #1:', purchase1Resp.data.error);
    }

    // Compra 2: Alimentos (RECEIVED)
    const purchase2Resp = await api('/purchases', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        supplierId: createdSuppliers[2]?.id,
        status: 'RECEIVED',
        items: [
          { productId: createdProducts[1]?.id, productName: createdProducts[1]?.name, quantity: 30, unitCost: 17.50, total: 525.00 },
          { productId: createdProducts[2]?.id, productName: createdProducts[2]?.name, quantity: 40, unitCost: 5.00, total: 200.00 },
        ],
      }),
    });
    if (purchase2Resp.ok) {
      createdPurchases.push(purchase2Resp.data);
      console.log('✅ Compra #2 (Alimentos, RECEIVED):', purchase2Resp.data.items?.length, 'itens');
    } else {
      console.log('⚠️  Compra #2:', purchase2Resp.data.error);
    }
  }

  // =========================================================
  // 10. CRIAR VENDAS (PDV)
  // =========================================================
  console.log('\n━━━ 10. VENDAS ━━━');

  if (createdProducts.length > 0) {
    // Venda 1: Produto simples (água)
    const order1Resp = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'PIX',
        source: 'POS',
        items: [
          { productId: createdProducts[0]?.id, productName: createdProducts[0]?.name, quantity: 2, unitPrice: createdProducts[0]?.price || 3.50 },
        ],
        subtotal: 7.00,
        discount: 0,
        total: 7.00,
      }),
    });
    if (order1Resp.ok) {
      createdOrders.push(order1Resp.data);
      console.log('✅ Venda #1 (2x Água, PIX): R$ 7.00 | Order #:', order1Resp.data.orderNumber);
    } else {
      console.log('⚠️  Venda #1:', order1Resp.data.error);
    }

    // Venda 2: Múltiplos itens (arroz + feijão + boné)
    const order2Resp = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'CREDIT_CARD',
        source: 'POS',
        items: [
          { productId: createdProducts[1]?.id, productName: createdProducts[1]?.name, quantity: 1, unitPrice: 25.90 },
          { productId: createdProducts[2]?.id, productName: createdProducts[2]?.name, quantity: 2, unitPrice: 8.90 },
          { productId: createdProducts[3]?.id, productName: createdProducts[3]?.name, quantity: 1, unitPrice: 49.90 },
        ],
        subtotal: 93.60,
        discount: 5.00,
        total: 88.60,
      }),
    });
    if (order2Resp.ok) {
      createdOrders.push(order2Resp.data);
      console.log('✅ Venda #2 (Arroz+Feijão+Boné, Crédito): R$ 88.60 | Order #:', order2Resp.data.orderNumber);
    } else {
      console.log('⚠️  Venda #2:', order2Resp.data.error);
    }

    // Venda 3: Venda com dinheiro
    const order3Resp = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        source: 'POS',
        items: [
          { productId: createdProducts[0]?.id, productName: createdProducts[0]?.name, quantity: 5, unitPrice: 3.50 },
        ],
        subtotal: 17.50,
        discount: 0,
        total: 17.50,
        amountReceived: 20.00,
        change: 2.50,
      }),
    });
    if (order3Resp.ok) {
      createdOrders.push(order3Resp.data);
      console.log('✅ Venda #3 (5x Água, Dinheiro): R$ 17.50 | Troco: R$ 2.50 | Order #:', order3Resp.data.orderNumber);
    } else {
      console.log('⚠️  Venda #3:', order3Resp.data.error);
    }
  }

  // =========================================================
  // 11. VERIFICAÇÃO FINAL DE ESTOQUE
  // =========================================================
  console.log('\n━━━ 11. VERIFICAÇÃO DE ESTOQUE ━━━');

  // Check products list
  const productsList = await api(`/products?tenantId=${tenantId}`);
  if (productsList.ok) {
    const prods = productsList.data.products || productsList.data || [];
    console.log(`Total produtos na loja: ${prods.length}`);
    for (const p of prods.slice(0, 10)) {
      const variations = p.variations ? ` (${p.variations.length} vars)` : '';
      console.log(`  ${p.name} | Estoque: ${p.stockQty} | Preço: R$ ${p.price}${variations}`);
    }
    if (prods.length > 10) console.log(`  ... mais ${prods.length - 10} produtos`);
  }

  // Check orders
  const ordersList = await api(`/orders?tenantId=${tenantId}`);
  if (ordersList.ok) {
    const orders = ordersList.data.orders || ordersList.data || [];
    console.log(`\nTotal vendas: ${orders.length}`);
    for (const o of orders.slice(0, 5)) {
      console.log(`  #${o.orderNumber} | ${o.status} | ${o.paymentMethod} | R$ ${o.total} | ${o.items?.length || '?'} itens`);
    }
  }

  // Check purchases
  const purchasesList = await api(`/purchases?tenantId=${tenantId}`);
  if (purchasesList.ok) {
    const purchases = purchasesList.data.purchases || purchasesList.data || [];
    console.log(`\nTotal compras: ${purchases.length}`);
    for (const p of purchases.slice(0, 5)) {
      console.log(`  #${p.orderNumber} | ${p.status} | ${p.supplier?.name || '?'} | ${p.items?.length || '?'} itens`);
    }
  }

  // Check suppliers
  const suppliersList = await api(`/suppliers?tenantId=${tenantId}`);
  if (suppliersList.ok) {
    const sups = suppliersList.data.suppliers || suppliersList.data || [];
    console.log(`\nTotal fornecedores: ${sups.length}`);
    sups.forEach(s => console.log(`  ${s.name} | CNPJ: ${s.cnpj || 'N/A'}`));
  }

  // Check cash flow
  const cashFlowResp = await api(`/cash-flows?tenantId=${tenantId}`);
  if (cashFlowResp.ok) {
    const cf = cashFlowResp.data.cashFlows || cashFlowResp.data || [];
    console.log(`\nFluxo de caixa: ${cf.length} registros`);
    cf.slice(0, 5).forEach(c => console.log(`  ${c.type} | ${c.category} | R$ ${c.amount}`));
  }

  // Check inventory batches
  const batchesResp = await api(`/inventory/batches?tenantId=${tenantId}`);
  if (batchesResp.ok) {
    const batches = batchesResp.data.batches || batchesResp.data || [];
    console.log(`\nLotes de estoque: ${batches.length}`);
    batches.slice(0, 5).forEach(b => console.log(`  ${b.product?.name || '?'} | Qtd: ${b.quantity} | Restante: ${b.remainingQty} | Custo: R$ ${b.unitCost}`));
  }

  // Check inventory movements
  const movResp = await api(`/inventory/movements?tenantId=${tenantId}&limit=10`);
  if (movResp.ok) {
    const movs = movResp.data.movements || movResp.data || [];
    console.log(`\nMovimentações de estoque: ${movs.length}`);
    movs.slice(0, 5).forEach(m => console.log(`  ${m.type} | ${m.product?.name || '?'} | Qtd: ${m.quantity}`));
  }

  // =========================================================
  // 12. RESUMO FINAL
  // =========================================================
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  RESUMO DO TESTE                         ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Usuários criados: ${createdUsers.length}                      ║`);
  console.log(`║  Templates: ${createdTemplates.length}                        ║`);
  console.log(`║  Categorias: ${createdCategories.length}                       ║`);
  console.log(`║  Fornecedores: ${createdSuppliers.length}                      ║`);
  console.log(`║  Produtos criados: ${createdProducts.length}                   ║`);
  console.log(`║  Compras: ${createdPurchases.length}                           ║`);
  console.log(`║  Vendas: ${createdOrders.length}                               ║`);
  console.log('╚══════════════════════════════════════════╝');

  console.log('\n✅ TESTE COMPLETO CONCLUÍDO!');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
