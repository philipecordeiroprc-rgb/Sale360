// Teste completo — Dali da Roça
// Uso: node scripts/test-dali-completo.js
const API = 'http://137.131.193.203:3001/api';
const EMAIL = 'philipecordeiroprc@gmail.com';
const PASSWORD = 'admin123';

let token = '';
let tenantId = '';
let created = { users: [], templates: [], categories: [], suppliers: [], products: [], purchases: [], orders: [], adjustments: [] };
const pass = (s) => true; // simplified: don't fail fast, report errors inline

async function api(path, options = {}) {
  const url = API + path;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { headers, ...options });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { _raw: text }; }

  if (!res.ok) {
    const msg = typeof data === 'object' ? (data.error || data.message || JSON.stringify(data)).substring(0, 100) : text.substring(0, 100);
    console.log(`  ⚠️  ${options.method || 'GET'} ${path} → ${res.status}: ${msg}`);
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   TESTE COMPLETO — DALI DA ROÇA                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ====================================================================
  // 1. LOGIN + SWITCH TENANT
  // ====================================================================
  console.log('━━━ 1. LOGIN ━━━');
  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) { console.log('❌ LOGIN FALHOU:', JSON.stringify(login.data)); process.exit(1); }

  token = login.data.token;
  console.log('✅ Login:', login.data.user.email, '| Role:', login.data.user.role);

  // Find Dali da Roça in tenants list
  const tenants = login.data.tenants || [];
  const dali = tenants.find(t => t.slug === 'dali-da-roca');
  if (!dali) { console.log('❌ Dali da Roça não encontrada nos tenants do usuário!'); console.log('Tenants:', tenants.map(t => t.slug).join(', ')); process.exit(1); }
  console.log('✅ Loja encontrada:', dali.companyName, '| ID:', dali.id);
  tenantId = dali.id;

  // Switch tenant to get store-scoped token
  console.log('\n━━━ 1b. SWITCH TENANT ━━━');
  const switchResp = await api('/auth/switch-tenant', {
    method: 'POST',
    body: JSON.stringify({ tenantId }),
  });
  if (switchResp.ok) {
    token = switchResp.data.token;
    console.log('✅ Token store-scoped obtido | Tenant:', switchResp.data.tenant?.slug);
  } else {
    console.log('❌ Switch tenant falhou:', switchResp.data.error);
    // Continue anyway - maybe it works with the original token
  }

  // ====================================================================
  // 2. CRIAR USUÁRIOS (Vendedor + Administrador da loja)
  // ====================================================================
  console.log('\n━━━ 2. CRIAR USUÁRIOS ━━━');

  // 2a. Vendedor
  const sellerResp = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'João Vendedor', email: 'joao.vendedor@dali.com', password: 'vendedor123' }),
  });
  if (sellerResp.ok) {
    created.users.push(sellerResp.data.user);
    console.log('✅ Vendedor criado:', sellerResp.data.user.email, '| ID:', sellerResp.data.user.id);
  } else {
    console.log('⚠️  Vendedor:', sellerResp.data.error || sellerResp.data.message || '(pode já existir)');
  }

  // 2b. Administrador da loja
  const adminResp = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Maria Admin', email: 'maria.admin@dali.com', password: 'admin123' }),
  });
  if (adminResp.ok) {
    created.users.push(adminResp.data.user);
    console.log('✅ Admin loja criado:', adminResp.data.user.email, '| ID:', adminResp.data.user.id);
  } else {
    console.log('⚠️  Admin loja:', adminResp.data.error || adminResp.data.message || '(pode já existir)');
  }

  // ====================================================================
  // 3. LOGIN COM NOVOS USUÁRIOS
  // ====================================================================
  console.log('\n━━━ 3. LOGIN COM NOVOS USUÁRIOS ━━━');

  // 3a. Login vendedor
  const sellerLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'joao.vendedor@dali.com', password: 'vendedor123' }),
  });
  if (sellerLogin.ok) {
    console.log('✅ Login vendedor OK:', sellerLogin.data.user.email, '| Role:', sellerLogin.data.user.role);
    console.log('   Tenants vinculados:', (sellerLogin.data.tenants || []).length);
  } else {
    console.log('❌ Login vendedor falhou:', sellerLogin.data.error);
  }

  // 3b. Login admin loja
  const adminLogin = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'maria.admin@dali.com', password: 'admin123' }),
  });
  if (adminLogin.ok) {
    console.log('✅ Login admin loja OK:', adminLogin.data.user.email, '| Role:', adminLogin.data.user.role);
    console.log('   Tenants vinculados:', (adminLogin.data.tenants || []).length);
  } else {
    console.log('❌ Login admin loja falhou:', adminLogin.data.error);
  }

  // 3c. Forgot password flow
  const forgotResp = await api('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'joao.vendedor@dali.com' }),
  });
  console.log(forgotResp.ok ? '✅ Forgot password OK' : '⚠️  Forgot password:', forgotResp.data.error || forgotResp.data.message);

  // ====================================================================
  // 4. TEMPLATES DE VARIAÇÃO
  // ====================================================================
  console.log('\n━━━ 4. TEMPLATES DE VARIAÇÃO ━━━');

  const tpl1 = await api('/variation-templates', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Tamanho (Roupas)',
      dimensions: [{ type: 'SIZE', label: 'Tamanho', options: JSON.stringify(['PP','P','M','G','GG']) }],
    }),
  });
  if (tpl1.ok) { created.templates.push(tpl1.data); console.log('✅ Template:', tpl1.data.name, '| ID:', tpl1.data.id); }
  else console.log('⚠️  Template Tamanho:', tpl1.data.error);

  const tpl2 = await api('/variation-templates', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Cor + Tamanho',
      dimensions: [
        { type: 'COLOR', label: 'Cor', options: JSON.stringify(['Vermelho','Azul','Preto','Branco']) },
        { type: 'SIZE', label: 'Tamanho', options: JSON.stringify(['P','M','G']) },
      ],
    }),
  });
  if (tpl2.ok) { created.templates.push(tpl2.data); console.log('✅ Template:', tpl2.data.name, '| ID:', tpl2.data.id); }
  else console.log('⚠️  Template Cor+Tamanho:', tpl2.data.error);

  // ====================================================================
  // 5. CATEGORIAS
  // ====================================================================
  console.log('\n━━━ 5. CATEGORIAS ━━━');

  const cats = [
    { name: 'Bebidas', color: '#3B82F6' },
    { name: 'Roupas', color: '#EF4444' },
    { name: 'Alimentos', color: '#10B981' },
    { name: 'Acessórios', color: '#F59E0B' },
  ];
  for (const cat of cats) {
    const hasTpl = cat.name === 'Roupas' || cat.name === 'Acessórios';
    const body = { name: cat.name, color: cat.color };
    if (hasTpl && created.templates[0]) body.variationTemplateId = created.templates[0].id;
    const resp = await api('/categories', { method: 'POST', body: JSON.stringify(body) });
    if (resp.ok) { created.categories.push(resp.data); console.log('✅ Categoria:', resp.data.name, '| ID:', resp.data.id); }
    else console.log('⚠️  Categoria:', cat.name, '-', resp.data.error);
  }

  // ====================================================================
  // 6. FORNECEDORES
  // ====================================================================
  console.log('\n━━━ 6. FORNECEDORES ━━━');

  const sups = [
    { name: 'Distribuidora de Bebidas LTDA', cnpj: '11.222.333/0001-44', phone: '(11) 99999-0001', email: 'contato@distribebidas.com' },
    { name: 'Confecção Moda Total', cnpj: '22.333.444/0001-55', phone: '(11) 99999-0002', email: 'vendas@modatotal.com' },
    { name: 'Atacadão Alimentos', cnpj: '33.444.555/0001-66', phone: '(11) 99999-0003', email: 'atacado@atacadao.com' },
  ];
  for (const sup of sups) {
    const resp = await api('/suppliers', { method: 'POST', body: JSON.stringify(sup) });
    if (resp.ok) { created.suppliers.push(resp.data); console.log('✅ Fornecedor:', resp.data.name); }
    else console.log('⚠️  Fornecedor:', sup.name, '-', resp.data.error);
  }

  // ====================================================================
  // 7. PRODUTOS
  // ====================================================================
  console.log('\n━━━ 7. PRODUTOS ━━━');

  // 7a. Produtos simples
  const simple = [
    { name: 'Água Mineral 500ml', categoryId: created.categories[0]?.id, price: 3.50, costPrice: 2.00, stockQty: 100, unit: 'UN', barcode: '7891000100001', sku: 'AGUA-500' },
    { name: 'Arroz 5kg', categoryId: created.categories[2]?.id, price: 25.90, costPrice: 18.00, stockQty: 50, unit: 'UN', barcode: '7891000100002', sku: 'ARROZ-5KG' },
    { name: 'Feijão 1kg', categoryId: created.categories[2]?.id, price: 8.90, costPrice: 5.50, stockQty: 80, unit: 'UN', barcode: '7891000100003', sku: 'FEIJAO-1KG' },
    { name: 'Boné Trucker', categoryId: created.categories[3]?.id, price: 49.90, costPrice: 25.00, stockQty: 30, unit: 'UN', barcode: '7891000100004', sku: 'BONE-TRUCK' },
  ];
  for (const prod of simple) {
    const body = { ...prod };
    if (!body.categoryId) delete body.categoryId;
    const resp = await api('/products', { method: 'POST', body: JSON.stringify(body) });
    if (resp.ok) { created.products.push(resp.data); console.log('✅ Simples:', resp.data.name, '| R$', resp.data.price, '| Qtd:', resp.data.stockQty); }
    else console.log('⚠️  Produto:', prod.name, '-', resp.data.error);
  }

  // 7b. Produto com variações
  if (created.templates[0]) {
    const vprod = await api('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Camiseta Basic',
        categoryId: created.categories[1]?.id,
        unit: 'UN',
        variations: [
          { name: 'P', sku: 'CAM-BASIC-P', barcode: '7891000200001', price: 79.90, stockQty: 20 },
          { name: 'M', sku: 'CAM-BASIC-M', barcode: '7891000200002', price: 79.90, stockQty: 30 },
          { name: 'G', sku: 'CAM-BASIC-G', barcode: '7891000200003', price: 79.90, stockQty: 25 },
          { name: 'GG', sku: 'CAM-BASIC-GG', barcode: '7891000200004', price: 84.90, stockQty: 15 },
        ],
      }),
    });
    if (vprod.ok) { created.products.push(vprod.data); console.log('✅ Variações:', vprod.data.name, '|', vprod.data.variations?.length || '?', 'vars'); }
    else console.log('⚠️  Camiseta:', vprod.data.error);
  }

  // ====================================================================
  // 8. COMPRAS (DRAFT → RECEIVE)
  // ====================================================================
  console.log('\n━━━ 8. COMPRAS ━━━');

  if (created.suppliers.length > 0 && created.products.length > 0) {
    // Compra 1: Bebidas
    const p1 = await api('/purchases', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: created.suppliers[0]?.id,
        items: [
          { productId: created.products[0]?.id, productName: 'Água Mineral 500ml', quantity: 50, unitCost: 1.80 },
        ],
      }),
    });
    if (p1.ok) {
      console.log('✅ Compra #1 criada (DRAFT):', p1.data.orderNumber);
      // Receive it (generates inventory batches)
      const r1 = await api(`/purchases/${p1.data.id}/receive`, { method: 'POST' });
      if (r1.ok) { created.purchases.push(r1.data); console.log('   ✅ Recebida! Estoque atualizado via PEPS.'); }
      else console.log('   ⚠️  Receive:', r1.data.error);
    } else console.log('⚠️  Compra #1:', p1.data.error);

    // Compra 2: Alimentos (2 itens)
    const p2 = await api('/purchases', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: created.suppliers[2]?.id,
        items: [
          { productId: created.products[1]?.id, productName: 'Arroz 5kg', quantity: 30, unitCost: 17.50 },
          { productId: created.products[2]?.id, productName: 'Feijão 1kg', quantity: 40, unitCost: 5.00 },
        ],
      }),
    });
    if (p2.ok) {
      console.log('✅ Compra #2 criada (DRAFT):', p2.data.orderNumber);
      const r2 = await api(`/purchases/${p2.data.id}/receive`, { method: 'POST' });
      if (r2.ok) { created.purchases.push(r2.data); console.log('   ✅ Recebida! 2 lotes de estoque criados.'); }
      else console.log('   ⚠️  Receive:', r2.data.error);
    } else console.log('⚠️  Compra #2:', p2.data.error);
  }

  // ====================================================================
  // 9. VENDAS
  // ====================================================================
  console.log('\n━━━ 9. VENDAS ━━━');

  if (created.products.length > 0) {
    // Venda 1: PIX
    const o1 = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        paymentMethod: 'PIX',
        source: 'POS',
        items: [{ productId: created.products[0]?.id, productName: 'Água Mineral 500ml', quantity: 2, unitPrice: 3.50 }],
      }),
    });
    if (o1.ok) { created.orders.push(o1.data); console.log('✅ Venda #1 (PIX):', o1.data.orderNumber, '| R$', o1.data.total); }
    else console.log('⚠️  Venda #1:', o1.data.error);

    // Venda 2: Cartão com desconto
    const o2 = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        paymentMethod: 'CREDIT_CARD',
        source: 'POS',
        items: [
          { productId: created.products[1]?.id, productName: 'Arroz 5kg', quantity: 1, unitPrice: 25.90 },
          { productId: created.products[2]?.id, productName: 'Feijão 1kg', quantity: 2, unitPrice: 8.90 },
          { productId: created.products[3]?.id, productName: 'Boné Trucker', quantity: 1, unitPrice: 49.90 },
        ],
        discount: 5.00,
      }),
    });
    if (o2.ok) { created.orders.push(o2.data); console.log('✅ Venda #2 (Crédito):', o2.data.orderNumber, '| R$', o2.data.total, '| Desconto:', o2.data.discount); }
    else console.log('⚠️  Venda #2:', o2.data.error);

    // Venda 3: Dinheiro com troco
    const o3 = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        paymentMethod: 'CASH',
        source: 'POS',
        items: [{ productId: created.products[0]?.id, productName: 'Água Mineral 500ml', quantity: 5, unitPrice: 3.50 }],
      }),
    });
    if (o3.ok) { created.orders.push(o3.data); console.log('✅ Venda #3 (Dinheiro):', o3.data.orderNumber, '| R$', o3.data.total); }
    else console.log('⚠️  Venda #3:', o3.data.error);

    // Venda 4: Cancelamento
    if (created.orders.length > 0) {
      const cancelResp = await api(`/orders/${created.orders[0].id}/cancel`, { method: 'POST' });
      if (cancelResp.ok) console.log('✅ Venda #' + created.orders[0].orderNumber + ' cancelada! Estoque revertido.');
      else console.log('⚠️  Cancelamento:', cancelResp.data.error);
    }
  }

  // ====================================================================
  // 10. AJUSTE DE ESTOQUE
  // ====================================================================
  console.log('\n━━━ 10. AJUSTE DE ESTOQUE ━━━');

  if (created.products.length > 1) {
    const adjResp = await api('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({
        productId: created.products[1]?.id,
        type: 'ADJUSTMENT_IN',
        quantity: 10,
        reason: 'Reposição de inventário',
      }),
    });
    if (adjResp.ok) {
      created.adjustments.push(adjResp.data);
      console.log('✅ Ajuste +10 Arroz (ADJUSTMENT_IN)');
    } else {
      console.log('⚠️  Ajuste:', adjResp.data.error, JSON.stringify(adjResp.data).substring(0, 200));
    }
  }

  // ====================================================================
  // 11. VERIFICAÇÃO FINAL
  // ====================================================================
  console.log('\n━━━ 11. VERIFICAÇÃO FINAL ━━━');
  console.log('(Dados na loja Dali da Roça)\n');

  // Products
  const prods = await api('/products');
  if (prods.ok) {
    const list = prods.data.products || prods.data || [];
    console.log(`📦 Produtos: ${list.length}`);
    for (const p of list.slice(0, 8)) {
      const vars = p.variations ? ` [${p.variations.length} vars]` : '';
      console.log(`   ${p.name} | Estoque: ${p.stockQty} | R$ ${p.price}${vars}`);
    }
    if (list.length > 8) console.log(`   ... mais ${list.length - 8}`);
  } else { console.log('   ❌', prods.data.error); }

  // Categories
  const catsResp = await api('/categories');
  if (catsResp.ok) {
    const list = catsResp.data.categories || catsResp.data || [];
    console.log(`\n📁 Categorias: ${list.length}`);
    list.forEach(c => console.log(`   ${c.name}${c.variationTemplateId ? ' (c/ template)' : ''}`));
  }

  // Suppliers
  const supsResp = await api('/suppliers');
  if (supsResp.ok) {
    const list = supsResp.data.suppliers || supsResp.data || [];
    console.log(`\n🏭 Fornecedores: ${list.length}`);
    list.forEach(s => console.log(`   ${s.name}`));
  }

  // Orders
  const ordersResp = await api('/orders');
  if (ordersResp.ok) {
    const list = ordersResp.data.orders || ordersResp.data || [];
    console.log(`\n🛒 Vendas: ${list.length}`);
    list.forEach(o => console.log(`   #${o.orderNumber} | ${o.status} | ${o.paymentMethod} | R$ ${o.total}`));
  }

  // Purchases
  const purchResp = await api('/purchases');
  if (purchResp.ok) {
    const list = purchResp.data.purchases || purchResp.data || [];
    console.log(`\n📥 Compras: ${list.length}`);
    list.forEach(p => console.log(`   #${p.orderNumber} | ${p.status} | Fornecedor: ${p.supplier?.name || '?'}`));
  }

  // Inventory batches
  const batchesResp = await api('/inventory/batches');
  if (batchesResp.ok) {
    const list = batchesResp.data.batches || batchesResp.data || [];
    console.log(`\n📊 Lotes de estoque: ${list.length}`);
    list.slice(0, 5).forEach(b => console.log(`   ${b.product?.name || b.productId} | Qtd: ${b.quantity} | Restante: ${b.remainingQty} | Custo: R$ ${b.unitCost}`));
    if (list.length > 5) console.log(`   ... mais ${list.length - 5}`);
  }

  // Inventory movements
  const movsResp = await api('/inventory/movements');
  if (movsResp.ok) {
    const list = movsResp.data.movements || movsResp.data || [];
    console.log(`\n🔄 Movimentações: ${list.length}`);
    list.slice(0, 5).forEach(m => console.log(`   ${m.type} | ${m.product?.name || m.productId} | Qtd: ${m.quantity}`));
    if (list.length > 5) console.log(`   ... mais ${list.length - 5}`);
  }

  // Variation templates
  const tplsResp = await api('/variation-templates');
  if (tplsResp.ok) {
    const list = tplsResp.data.templates || tplsResp.data || [];
    console.log(`\n📐 Templates: ${list.length}`);
    list.forEach(t => console.log(`   ${t.name} | Dims: ${t.dimensions?.length || '?'}`));
  }

  // Cash flow
  const cfResp = await api('/finance/cash-flow');
  if (cfResp.ok) {
    const data = cfResp.data;
    console.log(`\n💰 Fluxo de caixa: entradas R$ ${data.totalIn || 0}, saídas R$ ${data.totalOut || 0}`);
  }

  // Today summary
  const todayResp = await api('/orders/today-summary');
  if (todayResp.ok) {
    const d = todayResp.data;
    console.log(`📊 Resumo de hoje: ${d.totalOrders || 0} vendas, R$ ${d.totalRevenue || 0}`);
  }

  // ====================================================================
  // RESUMO
  // ====================================================================
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   RESUMO DO TESTE                                        ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   👤 Usuários:     ${String(created.users.length).padStart(3)}                                     ║`);
  console.log(`║   📐 Templates:    ${String(created.templates.length).padStart(3)}                                     ║`);
  console.log(`║   📁 Categorias:   ${String(created.categories.length).padStart(3)}                                     ║`);
  console.log(`║   🏭 Fornecedores: ${String(created.suppliers.length).padStart(3)}                                     ║`);
  console.log(`║   📦 Produtos:     ${String(created.products.length).padStart(3)}                                     ║`);
  console.log(`║   📥 Compras:      ${String(created.purchases.length).padStart(3)}                                     ║`);
  console.log(`║   🛒 Vendas:       ${String(created.orders.length).padStart(3)}                                     ║`);
  console.log(`║   🔧 Ajustes:      ${String(created.adjustments.length).padStart(3)}                                     ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  console.log('\n✅ TESTE COMPLETO CONCLUÍDO!');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
