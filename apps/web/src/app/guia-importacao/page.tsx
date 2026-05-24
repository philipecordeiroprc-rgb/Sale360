'use client';

import { Download, ArrowRight, ArrowDown, FileSpreadsheet, CheckCircle2, AlertTriangle, Star, BookOpen } from 'lucide-react';

const templates = [
  { step: 1, name: 'Templates de Variação', file: 'import_templates_variacao.csv', depends: '—', emoji: '📐' },
  { step: 2, name: 'Categorias', file: 'import_categorias.csv', depends: 'Templates (se houver)', emoji: '📁' },
  { step: 3, name: 'Fornecedores', file: 'import_fornecedores.csv', depends: '—', emoji: '🏭' },
  { step: 4, name: 'Produtos (Simples)', file: 'import_produtos.csv', depends: 'Categorias (opcional)', emoji: '📦' },
  { step: 4, name: 'Produtos (Variações)', file: 'import_produtos_variacoes.csv', depends: 'Templates + Categorias', emoji: '👕' },
  { step: 5, name: 'Compras', file: 'import_compras.csv', depends: 'Fornecedores + Produtos', emoji: '⭐' },
];

const dimensionTypes = [
  { code: 'TAMANHO_LETRA', desc: 'Tamanho por letra', example: 'PP, P, M, G, GG, XG, XGG' },
  { code: 'TAMANHO_NUMERO', desc: 'Tamanho por número', example: '2, 4, 6, 8... ou 34, 35, 36... 44' },
  { code: 'COR', desc: 'Cor do produto', example: 'Vermelho, Azul, Preto, Branco' },
  { code: 'VOLUME', desc: 'Volume líquido', example: '200ml, 350ml, 500ml, 1L, 2L' },
  { code: 'PESO', desc: 'Peso', example: '100g, 250g, 500g, 1kg, 5kg' },
  { code: 'PERSONALIZADO', desc: 'Dimensão livre', example: 'Qualquer valor definido pelo lojista' },
];

const statusEffects = [
  { status: 'RECEIVED', batch: true, stock: true, usage: 'Mercadoria já recebida — usar na importação inicial' },
  { status: 'CONFIRMED', batch: false, stock: false, usage: 'Pedido feito, aguardando entrega' },
  { status: 'DRAFT', batch: false, stock: false, usage: 'Rascunho — não afeta nada' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function FieldTable({ fields }: { fields: { name: string; required: boolean; type: string; desc: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900">
            <th className="text-left px-4 py-2.5 text-slate-300 font-semibold text-xs uppercase tracking-wider">Campo</th>
            <th className="text-center px-3 py-2.5 text-slate-300 font-semibold text-xs uppercase tracking-wider w-20">Obrig.</th>
            <th className="text-left px-3 py-2.5 text-slate-300 font-semibold text-xs uppercase tracking-wider w-20">Tipo</th>
            <th className="text-left px-4 py-2.5 text-slate-300 font-semibold text-xs uppercase tracking-wider">Descrição</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {fields.map((f, i) => (
            <tr key={i} className="hover:bg-slate-900/50 transition-colors">
              <td className="px-4 py-2.5 text-white font-medium">{f.name}</td>
              <td className="px-3 py-2.5 text-center">
                {f.required ? (
                  <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> SIM
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs">não</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-slate-400 text-xs">{f.type}</td>
              <td className="px-4 py-2.5 text-slate-300">{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GuiaImportacaoPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <BookOpen size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Guia de Importação</h1>
              <p className="text-slate-400 text-sm">Sale360 — Importe seu catálogo completo em 5 passos</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400">
              <FileSpreadsheet size={12} /> CSV com separador <code className="text-indigo-400 font-mono">;</code>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400">
              Encoding <code className="text-indigo-400 font-mono">UTF-8</code>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-2">

        {/* Sequence Diagram */}
        <Section title="Sequência Correta de Importação">
          <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 mb-4">
            <p className="text-sm text-slate-300 mb-1">
              <strong className="text-white">Siga a ordem abaixo.</strong> Cada etapa depende das anteriores.
              Pule as etapas que não se aplicam à sua loja.
            </p>
            <p className="text-xs text-slate-500">
              A etapa mais importante é a <strong className="text-amber-400">#5 Compras</strong> — é ela que gera os lotes de estoque (PEPS/FIFO) e o histórico de rastreio.
            </p>
          </div>

          {/* Desktop sequence */}
          <div className="hidden md:flex items-start gap-1 justify-between mb-6">
            {templates.map((t, i) => {
              const isLast = t.step === 5;
              return (
                <div key={t.file} className="flex items-start gap-1 flex-1">
                  <div className={`flex flex-col items-center rounded-xl p-3 text-center flex-1 transition-colors ${
                    isLast
                      ? 'bg-amber-500/10 border border-amber-500/30 ring-1 ring-amber-500/20'
                      : 'bg-slate-900 border border-slate-800'
                  }`}>
                    <span className="text-lg mb-1">{t.emoji}</span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 ${
                      isLast ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {t.step}
                    </div>
                    <span className="text-xs font-semibold text-white leading-tight">{t.name}</span>
                    <span className="text-[10px] text-slate-500 mt-1">Dep: {t.depends}</span>
                    <a
                      href={`/templates/${t.file}`}
                      download
                      className="inline-flex items-center gap-1 mt-2 text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Download size={10} />
                      Baixar CSV
                    </a>
                  </div>
                  {i < templates.length - 1 && (
                    <div className="flex items-center pt-8 flex-shrink-0">
                      <ArrowRight size={14} className="text-slate-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile sequence */}
          <div className="md:hidden space-y-2 mb-6">
            {templates.map((t, i) => {
              const isLast = t.step === 5;
              return (
                <div key={t.file}>
                  <div className={`flex items-center gap-3 rounded-xl p-3 ${
                    isLast
                      ? 'bg-amber-500/10 border border-amber-500/30'
                      : 'bg-slate-900 border border-slate-800'
                  }`}>
                    <span className="text-xl">{t.emoji}</span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isLast ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {t.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-white">{t.name}</span>
                      <p className="text-[11px] text-slate-500">Depende de: {t.depends}</p>
                    </div>
                    <a
                      href={`/templates/${t.file}`}
                      download
                      className="flex-shrink-0 p-2 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 rounded-lg transition-colors"
                    >
                      <Download size={15} />
                    </a>
                  </div>
                  {i < templates.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown size={14} className="text-slate-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Resumo */}
        <Section title="O que cada etapa cria">
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900">
                  <th className="text-left px-4 py-2.5 text-slate-300 font-semibold text-xs uppercase tracking-wider">Etapa</th>
                  <th className="text-left px-4 py-2.5 text-slate-300 font-semibold text-xs uppercase tracking-wider">Registros criados</th>
                  <th className="text-center px-4 py-2.5 text-slate-300 font-semibold text-xs uppercase tracking-wider w-24">Rastreio de Lote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-2.5 text-white font-medium">1. Templates</td>
                  <td className="px-4 py-2.5 text-slate-300"><code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">VariationTemplate</code> + <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">VariationDimension</code></td>
                  <td className="px-4 py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-2.5 text-white font-medium">2. Categorias</td>
                  <td className="px-4 py-2.5 text-slate-300"><code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">Category</code></td>
                  <td className="px-4 py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-2.5 text-white font-medium">3. Fornecedores</td>
                  <td className="px-4 py-2.5 text-slate-300"><code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">Supplier</code></td>
                  <td className="px-4 py-2.5 text-center text-slate-600">—</td>
                </tr>
                <tr className="hover:bg-slate-900/50">
                  <td className="px-4 py-2.5 text-white font-medium">4. Produtos</td>
                  <td className="px-4 py-2.5 text-slate-300"><code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">Product</code> (+ <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">ProductVariation</code>)</td>
                  <td className="px-4 py-2.5 text-center"><span className="text-red-400 text-xs font-medium">NÃO</span></td>
                </tr>
                <tr className="bg-amber-500/5 hover:bg-amber-500/10">
                  <td className="px-4 py-2.5 text-white font-medium flex items-center gap-1.5"><Star size={12} className="text-amber-400" /> 5. Compras</td>
                  <td className="px-4 py-2.5 text-slate-300 text-xs">
                    <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">Purchase</code> → <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">PurchaseItem</code> → <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">InventoryBatch</code> → <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">InventoryMovement</code> → atualiza <code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">Product.stockQty</code>
                  </td>
                  <td className="px-4 py-2.5 text-center"><CheckCircle2 size={16} className="text-emerald-400 mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* 1. Templates */}
        <Section title="1. Templates de Variação">
          <p className="text-sm text-slate-400 mb-4">
            Define os templates de variação. <strong className="text-white">Só importe se sua loja trabalha com produtos que variam</strong> (roupas, calçados, bebidas).
          </p>
          <FieldTable fields={[
            { name: 'Nome do Template', required: true, type: 'Texto', desc: 'Nome único do template (ex: Vestuário Infantil)' },
            { name: 'Dim 1 - Tipo', required: true, type: 'Enum', desc: 'Tipo da 1ª dimensão (veja tabela abaixo)' },
            { name: 'Dim 1 - Rótulo', required: true, type: 'Texto', desc: 'Nome exibido na UI (ex: Tamanho)' },
            { name: 'Dim 1 - Opções', required: true, type: 'Lista', desc: 'Valores separados por vírgula (ex: 2,4,6,8,10)' },
            { name: 'Dim 2 - Tipo', required: false, type: 'Enum', desc: 'Tipo da 2ª dimensão' },
            { name: 'Dim 2 - Rótulo', required: false, type: 'Texto', desc: 'Nome exibido na UI (ex: Cor)' },
            { name: 'Dim 2 - Opções', required: false, type: 'Lista', desc: 'Valores separados por vírgula' },
          ]} />

          <h4 className="text-sm font-semibold text-white mt-5 mb-2">Tipos de Dimensão</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {dimensionTypes.map(dt => (
              <div key={dt.code} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                <code className="text-xs text-indigo-400 font-mono font-semibold">{dt.code}</code>
                <p className="text-xs text-slate-300 mt-1">{dt.desc}</p>
                <p className="text-[10px] text-slate-500 mt-1">Ex: {dt.example}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 2. Categorias */}
        <Section title="2. Categorias">
          <FieldTable fields={[
            { name: 'Nome', required: true, type: 'Texto', desc: 'Nome da categoria (único por loja)' },
            { name: 'Cor (hex)', required: false, type: 'Cor', desc: 'Cor em hexadecimal para a UI (ex: #22c55e)' },
            { name: 'Ordem', required: false, type: 'Número', desc: 'Ordem de exibição (0 = primeiro)' },
            { name: 'Template de Variação', required: false, type: 'Texto', desc: 'Nome exato do template importado no Passo 1' },
          ]} />
        </Section>

        {/* 3. Fornecedores */}
        <Section title="3. Fornecedores">
          <FieldTable fields={[
            { name: 'Nome', required: true, type: 'Texto', desc: 'Nome do fornecedor' },
            { name: 'CNPJ', required: false, type: 'Texto', desc: 'CNPJ (formato: 12.345.678/0001-90) — único no sistema' },
            { name: 'IE', required: false, type: 'Texto', desc: 'Inscrição Estadual' },
            { name: 'Email', required: false, type: 'Email', desc: 'Email de contato' },
            { name: 'Telefone', required: false, type: 'Texto', desc: 'Telefone fixo' },
            { name: 'WhatsApp', required: false, type: 'Texto', desc: 'Número WhatsApp' },
            { name: 'Contato', required: false, type: 'Texto', desc: 'Nome da pessoa de contato' },
            { name: 'Endereço', required: false, type: 'Texto', desc: 'Rua/Avenida' },
            { name: 'Número', required: false, type: 'Texto', desc: 'Número do endereço' },
            { name: 'Complemento', required: false, type: 'Texto', desc: 'Complemento (sala, galpão, etc.)' },
            { name: 'Bairro', required: false, type: 'Texto', desc: 'Bairro' },
            { name: 'Cidade', required: false, type: 'Texto', desc: 'Cidade' },
            { name: 'Estado', required: false, type: 'Texto', desc: 'UF (2 letras, ex: SP)' },
            { name: 'CEP', required: false, type: 'Texto', desc: 'CEP (formato: 01001-000)' },
            { name: 'Observações', required: false, type: 'Texto', desc: 'Notas internas sobre o fornecedor' },
            { name: 'Ativo', required: false, type: 'Texto', desc: 'SIM ou NÃO — padrão: SIM' },
          ]} />
        </Section>

        {/* 4. Produtos Simples */}
        <Section title="4. Produtos Simples">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 mb-4">
            <p className="text-xs text-slate-300">
              Para produtos <strong className="text-white">COM variações</strong> (roupas, calçados), use o template <code className="text-indigo-400 bg-slate-800 px-1 py-0.5 rounded text-xs">import_produtos_variacoes.csv</code>.
            </p>
          </div>
          <FieldTable fields={[
            { name: 'Nome', required: true, type: 'Texto', desc: 'Nome do produto' },
            { name: 'Descrição', required: false, type: 'Texto', desc: 'Descrição detalhada (IA pode gerar automaticamente)' },
            { name: 'SKU', required: false, type: 'Texto', desc: 'Código interno do produto' },
            { name: 'Código de Barras', required: false, type: 'Número', desc: 'Código EAN-13 (pode ser lido pela câmera do PDV)' },
            { name: 'Categoria', required: false, type: 'Texto', desc: 'Nome exato de uma categoria já cadastrada (Passo 2)' },
            { name: 'Preço de Venda', required: true, type: 'Decimal', desc: 'Preço final para o cliente (ex: 25,90)' },
            { name: 'Custo Unitário', required: false, type: 'Decimal', desc: 'Preço pago ao fornecedor por unidade' },
            { name: 'Custo Operacional', required: false, type: 'Decimal', desc: 'Custo fixo adicional (embalagem, frete)' },
            { name: 'Taxa (%)', required: false, type: 'Decimal', desc: 'Percentual médio da taxa de cartão (ex: 2,5)' },
            { name: 'Estoque Inicial', required: false, type: 'Decimal', desc: 'Quantidade inicial em estoque' },
            { name: 'Estoque Mínimo', required: false, type: 'Decimal', desc: 'Quantidade que dispara alerta de estoque baixo' },
            { name: 'Unidade', required: false, type: 'Texto', desc: 'UN, KG, G, L, ML, M, PC, CX, PAR, FD, PCT, M2 — padrão: UN' },
            { name: 'Ativo', required: false, type: 'Texto', desc: 'SIM ou NÃO — padrão: SIM' },
            { name: 'Fracionado', required: false, type: 'Texto', desc: 'SIM se vende por grama/kg/metro (frios, granel) — padrão: NÃO' },
          ]} />

          <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
            <p className="text-xs text-slate-300">
              <strong className="text-amber-400">Importante sobre estoque:</strong> O campo "Estoque Inicial" define a quantidade inicial, mas <strong>não gera lote de estoque (InventoryBatch)</strong>. Para ter rastreio PEPS/FIFO completo, importe também as <strong>Compras (Passo 5)</strong>.
            </p>
          </div>
        </Section>

        {/* 4B. Produtos com Variações */}
        <Section title="4B. Produtos com Variações">
          <p className="text-sm text-slate-400 mb-4">
            Para produtos que possuem variações. <strong className="text-white">Cada linha representa UMA variação</strong>.
            O produto principal é criado automaticamente e as demais linhas com o mesmo nome adicionam variações a ele.
          </p>
          <FieldTable fields={[
            { name: 'Nome do Produto', required: true, type: 'Texto', desc: 'Nome base do produto (igual em todas as linhas do mesmo produto)' },
            { name: 'Categoria', required: false, type: 'Texto', desc: 'Nome da categoria (deve ter um template de variação vinculado)' },
            { name: 'Preço Base', required: true, type: 'Decimal', desc: 'Preço de venda base (ex: 49,90)' },
            { name: 'Dim 1', required: true, type: 'Texto', desc: 'Valor da 1ª dimensão. O nome da coluna deve ser o Rótulo da Dim 1' },
            { name: 'Dim 2', required: false, type: 'Texto', desc: 'Valor da 2ª dimensão. O nome da coluna deve ser o Rótulo da Dim 2' },
            { name: 'Qtd', required: true, type: 'Decimal', desc: 'Quantidade em estoque desta variação' },
            { name: 'Preço Extra', required: false, type: 'Decimal', desc: 'Acréscimo sobre o preço base (ex: tamanho G +5,00)' },
            { name: 'SKU', required: false, type: 'Texto', desc: 'Código interno desta variação' },
            { name: 'Código de Barras', required: false, type: 'Número', desc: 'Código EAN-13 específico da variação' },
            { name: 'Estoque Mínimo', required: false, type: 'Decimal', desc: 'Quantidade que dispara alerta de estoque baixo' },
          ]} />
        </Section>

        {/* 5. Compras */}
        <Section title="5. Compras">
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <Star size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">Etapa mais importante</h4>
                <p className="text-xs text-slate-300">
                  Esta etapa gera os <strong className="text-white">lotes de estoque (PEPS/FIFO)</strong> e cria o <strong className="text-white">histórico de rastreio</strong>.
                  Linhas com o mesmo Nº Pedido + mesmo Fornecedor são agrupadas na mesma compra.
                </p>
              </div>
            </div>
          </div>

          <FieldTable fields={[
            { name: 'Nº Pedido', required: true, type: 'Número', desc: 'Número sequencial da compra (agrupa itens do mesmo pedido)' },
            { name: 'Fornecedor', required: true, type: 'Texto', desc: 'Nome exato do fornecedor cadastrado no Passo 3' },
            { name: 'Produto', required: true, type: 'Texto', desc: 'Nome exato do produto cadastrado no Passo 4' },
            { name: 'Variação', required: false, type: 'Texto', desc: 'Nome da variação (ex: 2 Rosa). Deixe vazio se não tiver' },
            { name: 'Quantidade', required: true, type: 'Decimal', desc: 'Quantidade recebida neste lote' },
            { name: 'Custo Unitário', required: true, type: 'Decimal', desc: 'Preço pago por unidade neste lote (ex: 18,50)' },
            { name: 'Preço de Venda', required: false, type: 'Decimal', desc: 'Preço de venda sugerido (atualiza o preço do produto)' },
            { name: 'Data Recebimento', required: true, type: 'Data', desc: 'Data de entrada no estoque — determina a ordem PEPS (DD/MM/AAAA)' },
            { name: 'Status', required: false, type: 'Texto', desc: 'RECEIVED, CONFIRMED ou DRAFT. Padrão: RECEIVED' },
            { name: 'Observação', required: false, type: 'Texto', desc: 'Notas sobre esta compra' },
          ]} />

          <h4 className="text-sm font-semibold text-white mt-5 mb-2">Efeito de cada Status</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            {statusEffects.map(s => (
              <div key={s.status} className={`rounded-xl p-3 border ${
                s.status === 'RECEIVED'
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-slate-900 border-slate-800'
              }`}>
                <code className="text-xs font-mono font-bold text-white">{s.status}</code>
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <span>Gera Lote?</span>
                  {s.batch ? <CheckCircle2 size={14} className="text-emerald-400" /> : <span className="text-red-400">NÃO</span>}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span>Atualiza Estoque?</span>
                  {s.stock ? <CheckCircle2 size={14} className="text-emerald-400" /> : <span className="text-red-400">NÃO</span>}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">{s.usage}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Exemplo de resultado</h4>
            <p className="text-xs text-slate-300 mb-2">
              Ao importar uma compra RECEIVED com 2 itens, o sistema cria automaticamente:
            </p>
            <div className="space-y-1 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400">→</span> <strong className="text-white">1 compra</strong> com 2 itens
              </div>
              <div className="flex items-center gap-2">
                <span className="text-indigo-400">→</span> <strong className="text-white">2 lotes</strong> de estoque (InventoryBatch)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-indigo-400">→</span> <strong className="text-white">2 movimentações</strong> (InventoryMovement tipo PURCHASE_IN)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-indigo-400">→</span> Estoque dos produtos <strong className="text-white">atualizado</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-indigo-400">→</span> PEPS ativo: vendas consomem primeiro o <strong className="text-white">lote mais antigo</strong>
              </div>
            </div>
          </div>
        </Section>

        {/* Instruções finais */}
        <Section title="Instruções de Uso">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { num: 1, text: 'Siga a sequência: Templates → Categorias → Fornecedores → Produtos → Compras' },
              { num: 2, text: 'Baixe o template desejado (CSV)' },
              { num: 3, text: 'Abra no Excel, Google Sheets ou LibreOffice Calc' },
              { num: 4, text: 'Ao salvar, use CSV (separador ponto e vírgula) e encoding UTF-8' },
              { num: 5, text: 'Preencha os dados — não remova nem altere a linha de cabeçalho' },
              { num: 6, text: 'Campos com indicador laranja são obrigatórios' },
              { num: 7, text: 'Faça upload do arquivo na respectiva tela do sistema' },
              { num: 8, text: 'O sistema fará uma pré-visualização com validação antes de confirmar' },
              { num: 9, text: 'Confira os dados na pré-visualização. Se houver erros, corrija e reenvie.' },
            ].map(item => (
              <div key={item.num} className="flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 flex-shrink-0">
                  {item.num}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div className="text-center py-8 border-t border-slate-800 mt-8">
          <p className="text-xs text-slate-600">
            Dúvidas? Entre em contato com o suporte Sale360.
          </p>
        </div>
      </div>
    </div>
  );
}
