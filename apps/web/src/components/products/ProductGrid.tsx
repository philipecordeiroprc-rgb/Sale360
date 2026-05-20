'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, ShoppingCart, Package } from 'lucide-react';
import api from '@/lib/api';
import { getProducts } from '@/lib/offline-db';

interface CartItem {
  productId?: string;
  variationId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ProductGridProps {
  onProductClick: (product: any) => void;
  cart: CartItem[];
  isOnline: boolean;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
}

export function ProductGrid({ onProductClick, cart, isOnline, productSearch, onProductSearchChange }: ProductGridProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string | null; name: string; count: number }[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchTimer = useRef<NodeJS.Timeout>(undefined);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await api.categories.list();
        const tabs = [
          { id: null as string | null, name: 'Todos', count: 0 },
          ...data.map((c: any) => ({
            id: c.id,
            name: c.name,
            count: c._count?.products || 0,
          })),
        ];
        if (tabs.length === 1) {
          // No categories, hide tabs — just use "Todos"
        }
        setCategories(tabs);
      } catch {
        setCategories([{ id: null, name: 'Todos', count: 0 }]);
      }
    };
    loadCategories();
  }, []);

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      setError('');

      if (!isOnline) {
        try {
          const cached = await getProducts();
          const active = cached.filter((p: any) => p.active !== false);
          setAllProducts(active);
          setProducts(active);
        } catch {
          setError('Voce esta offline. Nao foi possivel carregar produtos.');
        }
        setLoading(false);
        return;
      }

      try {
        const params: any = { active: true, limit: 100 };
        if (activeCategory) params.categoryId = activeCategory;
        const data = await api.products.list(params);
        setAllProducts(data.products);
        setProducts(data.products);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar produtos');
        // Fallback to IndexedDB
        try {
          const cached = await getProducts();
          const active = cached.filter((p: any) => p.active !== false);
          setAllProducts(active);
          setProducts(active);
          setError('');
        } catch {}
      }
      setLoading(false);
    };
    loadProducts();
  }, [isOnline, activeCategory]);

  // Client-side search (debounce)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(() => {
      const q = productSearch.toLowerCase().trim();
      if (!q) {
        setProducts(allProducts);
        return;
      }
      const filtered = allProducts.filter(
        (p: any) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
      );
      setProducts(filtered);
    }, 150);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [productSearch, allProducts]);

  // Count in cart for a product
  const cartCount = (product: any) =>
    cart
      .filter((c) => c.productId === product.id)
      .reduce((sum, c) => sum + c.quantity, 0);

  // Total stock (sum of variations if any, else product stock)
  const getStock = (product: any) => {
    if (product.variations?.length > 0) {
      return product.variations.reduce((sum: number, v: any) => sum + Number(v.stockQty || 0), 0);
    }
    return Number(product.stockQty || 0);
  };

  // Loading skeleton
  if (loading && allProducts.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-7 w-20 bg-slate-800 rounded-full animate-pulse shrink-0" />
          ))}
        </div>
        <div className="h-8 bg-slate-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-3 animate-pulse">
              <div className="h-20 bg-slate-800 rounded-lg mb-2" />
              <div className="h-3 bg-slate-800 rounded w-3/4 mb-1" />
              <div className="h-4 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && allProducts.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 gap-3">
        <Package size={32} className="text-slate-600" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      {categories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {categories.map((cat) => (
            <button
              key={cat.id ?? '__all__'}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeCategory === cat.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {cat.name}
              {cat.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeCategory === cat.id ? 'bg-white/20' : 'bg-slate-700'
                }`}>
                  {cat.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={productSearch}
          onChange={(e) => onProductSearchChange(e.target.value)}
          placeholder="Buscar por nome, SKU ou código..."
          className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-indigo-500 outline-none"
        />
        {productSearch && (
          <button
            onClick={() => onProductSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-white rounded"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Empty: no products at all */}
      {allProducts.length === 0 && !loading && (
        <div className="flex flex-col items-center py-8 gap-3">
          <Package size={32} className="text-slate-600" />
          <p className="text-sm text-slate-400">Nenhum produto cadastrado</p>
        </div>
      )}

      {/* Empty: filter no results */}
      {allProducts.length > 0 && products.length === 0 && (
        <div className="flex flex-col items-center py-6 gap-2">
          <Search size={24} className="text-slate-600" />
          <p className="text-sm text-slate-400">
            Nenhum produto encontrado{productSearch ? ` para "${productSearch}"` : ''}
          </p>
          {productSearch && (
            <button
              onClick={() => onProductSearchChange('')}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Limpar busca
            </button>
          )}
        </div>
      )}

      {/* Product grid */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {products.map((product) => {
            const stock = getStock(product);
            const inCart = cartCount(product);
            const outOfStock = stock <= 0;

            return (
              <button
                key={product.id}
                onClick={() => onProductClick(product)}
                disabled={outOfStock && inCart === 0}
                className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-left transition-all hover:border-indigo-500/50 ${
                  outOfStock && inCart === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {/* Image / placeholder */}
                <div className="h-24 sm:h-28 bg-slate-800 flex items-center justify-center">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-2xl sm:text-3xl text-slate-600 font-bold select-none">
                      {product.name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                  {/* In-cart badge */}
                  {inCart > 0 && (
                    <div className="absolute top-1.5 right-1.5 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {inCart}
                    </div>
                  )}
                  {/* Variation indicator */}
                  {product.hasVariations && (
                    <div className="absolute top-1.5 left-1.5 bg-slate-900/80 text-slate-300 text-[9px] px-1 py-0.5 rounded">
                      {product.variations?.length || 0} var.
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2 sm:p-2.5">
                  <p className="text-xs sm:text-sm text-white font-medium truncate">
                    {product.name}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm sm:text-base text-emerald-400 font-bold">
                      R$ {Number(product.price || 0).toFixed(2)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      outOfStock
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {outOfStock ? 'Esgotado' : `Est. ${stock}`}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Offline indicator */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-amber-400">
          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
          Modo offline — dados do cache local
        </div>
      )}
    </div>
  );
}
