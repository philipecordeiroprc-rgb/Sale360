// Teste completo — Dali da Roça (v3 — final)
const API = 'http://137.131.193.203:3001/api';
const EMAIL = 'philipecordeiroprc@gmail.com';
const PASSWORD = 'admin123';
let token = '';
let tenantId = '';
let created = { users: [], templates: [], categories: [], suppliers: [], products: [], purchases: [], orders: [], adjustments: [], variations: [] };

async function api(path, options = {}) {
  const url = API + path;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers, ...options });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { _raw: text.substring(0, 100) }; }
  if (!res.ok) {
    const msg = (data.error || data.message || text).substring(0, 120);
    console.log(`  ⚠️  ${options.method || 'GET'} ${path} → ${res.status}: ${msg}`);
  }
  return { ok: res.ok, status: res.status, data };
}

const ID = () => Math.random().toString(36).substring(2, 10);

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   TESTE COMPLETO — DALI DA ROÇA (v3 final)               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. LOGIN + SWITCH
  console.log('━━━ 1. LOGIN + SWITCH TENANT ━━━');
  const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  if (!login.ok) { console.log('❌ LOGIN FALHOU'); process.exit(1); }
  token = login.data.token;
  console.log('✅ Login:', login.data.user.email, '| Role:', login.data.user.role);
  const dali = (login.data.tenants || []).find(t => t.slug === 'dali-da-roca');
  if (!dali) { console.log('❌ Dali não encontrada'); process.exit(1); }
  tenantId = dali.id;
  const sw = await api('/auth/switch-tenant', { method: 'POST', body: JSON.stringify({ tenantId }) });
  if (sw.ok) { token = sw.data.token; console.log('✅ Switch:', sw.data.tenant?.slug); }
  else { console.log('❌ Switch falhou'); process.exit(1); }

  // 2. CRIAR USUÁRIOS
  console.log('\n━━━ 2. USUÁRIOS ━━━');
  const sellerResp = await api(`/admin/tenants/${tenantId}/users`, {
    method: 'POST', body: JSON.stringify({ name: 'João Vendedor', email: 'joao.vendedor@dali.com', password: 'vendedor123', role: 'CASHIER', pin: '1234' }),
  });
  if (sellerResp.ok) { created.users.push(sellerResp.data); console.log('✅ Vendedor CASHIER:', 'joao.vendedor@dali.com', '| PIN: 1234'); }
  else console.log('⚠️  Vendedor:', sellerResp.data.error);

  const adminResp = await api(`/admin/tenants/${tenantId}/users`, {
    method: 'POST', body: JSON.stringify({ name: 'Maria Admin', email: 'maria.admin@dali.com', password: 'admin123', role: 'OWNER', pin: '5678' }),
  });
  if (adminResp.ok) { created.users.push(adminResp.data); console.log('✅ Admin OWNER:', 'maria.admin@dali.com', '| PIN: 5678'); }
  else console.log('⚠️  Admin:', adminResp.data.error);

  // 3. LOGIN NOVOS USUÁRIOS
  console.log('\n━━━ 3. LOGIN NOVOS USUÁRIOS ━━━');
  const sellerLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'joao.vendedor@dali.com', password: 'vendedor123' }) });
  console.log(sellerLogin.ok ? `✅ Login Vendedor OK → tenant: ${sellerLogin.data.tenant?.slug}` : `❌ ${sellerLogin.data.error}`);

  const adminLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'maria.admin@dali.com', password: 'admin123' }) });
  console.log(adminLogin.ok ? `✅ Login Admin OK → tenant: ${adminLogin.data.tenant?.slug}` : `❌ ${adminLogin.data.error}`);

  // Forgot password
  const fp = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: 'joao.vendedor@dali.com' }) });
  console.log(fp.ok ? '✅ Forgot password OK' : '⚠️  Forgot password');

  // 4. TEMPLATES DE VARIAÇÃO
  console.log('\n━━━ 4. TEMPLATES DE VARIAÇÃO ━━━');
  const tpls = [
    { name: 'Tamanho (Roupas)', dimensions: [{ type: 'TAMANHO_LETRA', label: 'Tamanho', options: ['PP','P','M','G','GG'], orderIndex: 0 }] },
    { name: 'Cor + Tamanho', dimensions: [
      { type: 'COR', label: 'Cor', options: ['Vermelho','Azul','Preto','Branco'], orderIndex: 0 },
      { type: 'TAMANHO_LETRA', label: 'Tamanho', options: ['P','M','G'], orderIndex: 1 },
    ]},
  ];
  for (const t of tpls) {
    const r = await api('/variation-templates', { method: 'POST', body: JSON.stringify(t) });
    if (r.ok) { created.templates.push(r.data); console.log('✅ Template:', r.data.name, '|', r.data.dimensions?.length, 'dims'); }
    else console.log('⚠️  Template:', r.data.error);
  }

  // 5. CATEGORIAS
  console.log('\n━━━ 5. CATEGORIAS ━━━');
  const catDefs = [
    { name: 'Bebidas', color: '#3B82F6' },
    { name: 'Roupas', color: '#EF4444' },
    { name: 'Alimentos', color: '#10B981' },
    { name: 'Acessórios', color: '#F59E0B' },
  ];
  for (const c of catDefs) {
    const body = { ...c };
    if (c.name === 'Roupas' && created.templates[0]) body.variationTemplateId = created.templates[0].id;
    if (c.name === 'Acessórios' && created.templates[0]) body.variationTemplateId = created.templates[0].id;
    const r = await api('/categories', { method: 'POST', body: JSON.stringify(body) });
    if (r.ok) { created.categories.push(r.data); console.log('✅', r.data.name); }
    else console.log('⚠️', c.name, ':', r.data.error);
  }

  // 6. FORNECEDORES (CNPJs únicos para evitar conflito)
  console.log('\n━━━ 6. FORNECEDORES ━━━');
  const supDefs = [
    { name: 'Distribuidora de Bebidas LTDA', cnpj: `11.222.333/${ID()}-44`, phone: '(11) 99999-0001', email: 'contato@distribebidas.com' },
    { name: 'Confecção Moda Total', cnpj: `22.333.444/${ID()}-55`, phone: '(11) 99999-0002', email: 'vendas@modatotal.com' },
    { name: 'Atacadão Alimentos', cnpj: `33.444.555/${ID()}-66`, phone: '(11) 99999-0003', email: 'atacado@atacadao.com' },
  ];
  for (const s of supDefs) {
    const r = await api('/suppliers', { method: 'POST', body: JSON.stringify(s) });
    if (r.ok) { created.suppliers.push(r.data); console.log('✅', r.data.name, '| CNPJ:', r.data.cnpj); }
    else console.log('⚠️', s.name, ':', r.data.error);
  }

  // 7. PRODUTOS
  console.log('\n━━━ 7. PRODUTOS ━━━');
  const simple = [
    { name: 'Água Mineral 500ml', categoryId: created.categories[0]?.id, price: 3.50, barcode: '7891000100001', sku: 'AGUA-500' },
    { name: 'Arroz 5kg', categoryId: created.categories[2]?.id, price: 25.90, barcode: '7891000100002', sku: 'ARROZ-5KG' },
    { name: 'Feijão 1kg', categoryId: created.categories[2]?.id, price: 8.90, barcode: '7891000100003', sku: 'FEIJAO-1KG' },
    { name: 'Boné Trucker', categoryId: created.categories[3]?.id, price: 49.90, barcode: '7891000100004', sku: 'BONE-TRUCK' },
  ];
  for (const p of simple) {
    const r = await api('/products', { method: 'POST', body: JSON.stringify(p) });
    if (r.ok) { created.products.push(r.data); console.log('✅', r.data.name, '| R$', r.data.price, '| ID:', r.data.id.substring(0, 10) + '...'); }
    else console.log('⚠️', p.name, ':', r.data.error);
  }

  // 7b. Produto com variações (created separately)
  const camisetaResp = await api('/products', {
    method: 'POST', body: JSON.stringify({
      name: 'Camiseta Basic',
      categoryId: created.categories[1]?.id,
      price: 79.90,
      barcode: '7891000200000',
      sku: 'CAM-BASIC',
    }),
  });
  if (camisetaResp.ok) {
    created.products.push(camisetaResp.data);
    console.log('✅', camisetaResp.data.name, '| R$', camisetaResp.data.price, '(adicionando variações...)');

    // Add variations individually
    const variations = [
      { name: 'P', sku: 'CAM-BASIC-P', barcode: '7891000200001', price: 79.90, stockQty: 20 },
      { name: 'M', sku: 'CAM-BASIC-M', barcode: '7891000200002', price: 79.90, stockQty: 30 },
      { name: 'G', sku: 'CAM-BASIC-G', barcode: '7891000200003', price: 79.90, stockQty: 25 },
      { name: 'GG', sku: 'CAM-BASIC-GG', barcode: '7891000200004', price: 84.90, stockQty: 15 },
    ];
    for (const v of variations) {
      const vr = await api(`/products/${camisetaResp.data.id}/variations`, { method: 'POST', body: JSON.stringify(v) });
      if (vr.ok) created.variations.push(vr.data);
    }
    console.log('   ✅', created.variations.length, 'variações adicionadas');
  } else console.log('⚠️  Camiseta:', camisetaResp.data.error);

  // 8. COMPRAS (DRAFT → RECEIVE com PEPS)
  console.log('\n━━━ 8. COMPRAS ━━━');
  if (created.suppliers.length >= 2 && created.products.length >= 3) {
    const p1 = await api('/purchases', {
      method: 'POST', body: JSON.stringify({
        supplierId: created.suppliers[0]?.id,
        items: [{ productId: created.products[0]?.id, productName: 'Água Mineral 500ml', quantity: 50, unitCost: 1.80, total: 90.00 }],
      }),
    });
    if (p1.ok) {
      const r1 = await api(`/purchases/${p1.data.id}/receive`, { method: 'POST', body: JSON.stringify({}) });
      if (r1.ok) { created.purchases.push(r1.data); console.log('✅ Compra #1 recebida: Água x50 lote PEPS criado'); }
      else console.log('⚠️  Receive #1:', r1.data.error);
    } else console.log('⚠️  Compra #1:', p1.data.error);

    const p2 = await api('/purchases', {
      method: 'POST', body: JSON.stringify({
        supplierId: created.suppliers[2]?.id,
        items: [
          { productId: created.products[1]?.id, productName: 'Arroz 5kg', quantity: 30, unitCost: 17.50, total: 525.00 },
          { productId: created.products[2]?.id, productName: 'Feijão 1kg', quantity: 40, unitCost: 5.00, total: 200.00 },
        ],
      }),
    });
    if (p2.ok) {
      const r2 = await api(`/purchases/${p2.data.id}/receive`, { method: 'POST', body: JSON.stringify({}) });
      if (r2.ok) { created.purchases.push(r2.data); console.log('✅ Compra #2 recebida: Arroz x30 + Feijão x40, 2 lotes PEPS'); }
      else console.log('⚠️  Receive #2:', r2.data.error);
    } else console.log('⚠️  Compra #2:', p2.data.error);
  }

  // 9. VENDAS
  console.log('\n━━━ 9. VENDAS ━━━');
  if (created.products.length >= 4) {
    const o1 = await api('/orders', {
      method: 'POST', body: JSON.stringify({
        source: 'PDV', paymentMethod: 'Pix',
        items: [{ productId: created.products[0]?.id, productName: 'Água Mineral 500ml', quantity: 2, unitPrice: 3.50, total: 7.00 }],
        subtotal: 7.00, discount: 0, total: 7.00,
      }),
    });
    if (o1.ok) { created.orders.push(o1.data); console.log('✅ Venda #1 (PIX 2x Água):', o1.data.orderNumber, '| R$ 7.00'); }
    else console.log('⚠️  Venda #1:', o1.data.error);

    const o2 = await api('/orders', {
      method: 'POST', body: JSON.stringify({
        source: 'PDV', paymentMethod: 'Credito',
        items: [
          { productId: created.products[1]?.id, productName: 'Arroz 5kg', quantity: 1, unitPrice: 25.90, total: 25.90 },
          { productId: created.products[2]?.id, productName: 'Feijão 1kg', quantity: 2, unitPrice: 8.90, total: 17.80 },
          { productId: created.products[3]?.id, productName: 'Boné Trucker', quantity: 1, unitPrice: 49.90, total: 49.90 },
        ],
        subtotal: 93.60, discount: 5.00, total: 88.60,
      }),
    });
    if (o2.ok) { created.orders.push(o2.data); console.log('✅ Venda #2 (Crédito 3 itens -R$5):', o2.data.orderNumber, '| R$ 88.60'); }
    else console.log('⚠️  Venda #2:', o2.data.error);

    const o3 = await api('/orders', {
      method: 'POST', body: JSON.stringify({
        source: 'PDV', paymentMethod: 'Dinheiro',
        items: [{ productId: created.products[0]?.id, productName: 'Água Mineral 500ml', quantity: 5, unitPrice: 3.50, total: 17.50 }],
        subtotal: 17.50, discount: 0, total: 17.50,
      }),
    });
    if (o3.ok) { created.orders.push(o3.data); console.log('✅ Venda #3 (Dinheiro 5x Água):', o3.data.orderNumber, '| R$ 17.50'); }
    else console.log('⚠️  Venda #3:', o3.data.error);

    // Cancel first order
    if (created.orders.length > 0) {
      const cancel = await api(`/orders/${created.orders[0].id}/cancel`, { method: 'POST' });
      console.log(cancel.ok ? '✅ Cancelamento venda #' + created.orders[0].orderNumber + ' — estoque revertido' : '⚠️  Cancel: ' + cancel.data.error);
    }
  }

  // 10. AJUSTES DE ESTOQUE
  console.log('\n━━━ 10. AJUSTES DE ESTOQUE ━━━');
  const adj1 = await api('/inventory/adjust', {
    method: 'POST', body: JSON.stringify({ productId: created.products[1]?.id, type: 'ADJUSTMENT_IN', quantity: 10, reason: 'Sobra de inventário' }),
  });
  if (adj1.ok) { created.adjustments.push(adj1.data); console.log('✅ Ajuste +10 Arroz (ADJUSTMENT_IN)'); }
  else console.log('⚠️  Ajuste IN:', adj1.data.error);

  const adj2 = await api('/inventory/adjust', {
    method: 'POST', body: JSON.stringify({ productId: created.products[0]?.id, type: 'ADJUSTMENT_OUT', quantity: 3, reason: 'Perda — validade vencida' }),
  });
  if (adj2.ok) { created.adjustments.push(adj2.data); console.log('✅ Ajuste -3 Água (ADJUSTMENT_OUT)'); }
  else console.log('⚠️  Ajuste OUT:', adj2.data.error);

  // 11. VERIFICAÇÃO FINAL
  console.log('\n━━━ 11. VERIFICAÇÃO FINAL ━━━\n');

  const prods = await api('/products');
  if (prods.ok) {
    const list = prods.data.products || prods.data || [];
    console.log(`📦 Produtos: ${list.length}`);
    for (const p of list) {
      const vinfo = p.variations?.length ? ` [${p.variations.length} vars]` : '';
      console.log(`   ${p.name} | Estoque: ${p.stockQty} | R$ ${p.price}${vinfo}`);
    }
  }

  const orders = await api('/orders?limit=20');
  if (orders.ok) {
    const list = orders.data.orders || orders.data || [];
    console.log(`\n🛒 Vendas: ${list.length}`);
    list.forEach(o => console.log(`   #${o.orderNumber} | ${o.paymentMethod} | ${o.status} | R$ ${o.total}`));
  }

  const purch = await api('/purchases?limit=20');
  if (purch.ok) {
    const list = purch.data.purchases || purch.data || [];
    console.log(`\n📥 Compras: ${list.length}`);
    list.forEach(p => console.log(`   #${p.orderNumber} | ${p.status} | ${p.supplier?.name || '?'} | ${p.items?.length || '?'} itens`));
  }

  const batches = await api('/inventory/batches');
  if (batches.ok) {
    const list = batches.data.batches || batches.data || [];
    console.log(`\n📊 Lotes: ${list.length}`);
    list.forEach(b => console.log(`   ${b.product?.name || b.productId} | Qtd: ${b.quantity} | Restante: ${b.remainingQty} | Custo: R$ ${b.unitCost}`));
  }

  const movs = await api('/inventory/movements?limit=20');
  if (movs.ok) {
    const list = movs.data.movements || movs.data || [];
    console.log(`\n🔄 Movimentações: ${list.length}`);
    list.forEach(m => console.log(`   ${m.type} | ${m.product?.name || m.productId} | Qtd: ${m.quantity}`));
  }

  const today = await api('/orders/today-summary');
  if (today.ok) console.log(`\n📊 Hoje: ${today.data.totalOrders || 0} vendas, R$ ${today.data.totalRevenue || 0}`);

  const cats = await api('/categories');
  const sups = await api('/suppliers');
  console.log(`\n📁 Categorias: ${(cats.data.categories || cats.data).length} | 🏭 Fornecedores: ${(sups.data.suppliers || sups.data).length}`);
  console.log(`👤 Usuários: ${created.users.length} | 📐 Templates: ${created.templates.length} | 🔧 Ajustes: ${created.adjustments.length}`);

  console.log('\n✅ TESTE COMPLETO CONCLUÍDO!');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
