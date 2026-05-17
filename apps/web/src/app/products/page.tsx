'use client';

import { useState } from 'react';
import { Plus, Search, Barcode, Edit2, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

const sampleProducts = [
  { id: '1', name: 'Coca-Cola 350ml', category: 'Bebidas', price: 5.00, stock: 100, barcode: '7894900010015', active: true },
  { id: '2', name: 'Água Mineral 500ml', category: 'Bebidas', price: 3.00, stock: 200, barcode: '7894900010016', active: true },
  { id: '3', name: 'X-Burger', category: 'Lanches', price: 18.00, stock: 0, barcode: '', active: true },
  { id: '4', name: 'X-Salada', category: 'Lanches', price: 22.00, stock: 0, barcode: '', active: true },
  { id: '5', name: 'Açaí 300ml', category: 'Sobremesas', price: 16.00, stock: 30, barcode: '', active: false },
];

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filtered = sampleProducts.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.barcode?.includes(search)) return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Produtos</h2>
          <p className="text-slate-400 mt-1">{sampleProducts.length} produtos no catálogo</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-3 rounded-xl font-semibold transition-colors">
          <Plus size={20} />
          Novo Produto
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        {['all', 'Bebidas', 'Lanches', 'Sobremesas'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              selectedCategory === cat
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {cat === 'all' ? 'Todas' : cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((product) => (
          <div
            key={product.id}
            className={`bg-slate-900 border rounded-2xl p-5 transition-all hover:border-slate-500 ${
              product.active ? 'border-slate-800' : 'border-slate-800/50 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: getCategoryColor(product.category) + '20' }}
              >
                📦
              </div>
              <div className="flex gap-1">
                <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  <Edit2 size={16} className="text-slate-400" />
                </button>
                <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  {product.active
                    ? <ToggleRight size={16} className="text-emerald-400" />
                    : <ToggleLeft size={16} className="text-slate-400" />
                  }
                </button>
              </div>
            </div>

            <h3 className="text-white font-semibold text-lg mb-1">{product.name}</h3>

            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 bg-slate-800 rounded-md text-xs text-slate-400">{product.category}</span>
              {product.barcode && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Barcode size={12} />
                  {product.barcode}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-emerald-400">
                R$ {product.price.toFixed(2)}
              </span>
              <span className={`text-sm ${product.stock > 10 ? 'text-slate-400' : product.stock > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {product.stock > 0 ? `${product.stock} un` : 'Sem estoque'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCategoryColor(cat: string): string {
  const colors: Record<string, string> = {
    Bebidas: '#3B82F6',
    Lanches: '#F59E0B',
    Sobremesas: '#EC4899',
  };
  return colors[cat] || '#6366F1';
}
