'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart, X, Minus, Plus, Share2, AlertCircle, Check, Loader2, Search,
} from 'lucide-react';
import { useCartStore } from './cart-store';
import api from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

type Store = {
  name: string;
  phone: string | null;
  document: string | null;
  companyName: string | null;
  primaryColor: string;
  backgroundColor: string;
  displayMode: string;
  outOfStockBehavior: string;
  logoPath: string | null;
  acceptOrders: boolean;
  postOrderMessage: string | null;
  whatsAppNumber: string | null;
  receiveWhatsApp: boolean;
  instagram: string | null;
  email: string | null;
  aboutUs: string | null;
};

type Banner = { id: string; imagePath: string; linkUrl: string | null };
type Category = { id: string; name: string; color: string | null };
type PaymentMethod = {
  value: string;
  label: string;
  dueDays: number | null;
  instructions: string | null;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  hasVariations: boolean;
  stockQty: number;
  categoryId: string | null;
  category: Category | null;
  variations: Array<{
    id: string;
    name: string;
    price: number | null;
    stockQty: number;
  }>;
};

interface Props {
  slug: string;
  store: Store;
  banners: Banner[];
  paymentMethods: PaymentMethod[];
  categories: Category[];
  products: Product[];
}

function formatPrice(v: number): string {
  return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function formatMoney(v: number): string {
  return v.toFixed(2).replace('.', ',');
}

function buildOrderMessage(data: {
  orderNumber: string;
  slug: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number }>;
  customerName: string;
  customerPhone: string;
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
  paymentMethod: string;
}): string {
  const lines: string[] = [];
  lines.push(`*PEDIDO #${data.orderNumber}*`);
  lines.push('');
  lines.push(`*Link para novos pedidos:* https://sale360.jvp.app/${data.slug}`);
  lines.push('');
  lines.push('-------------------------------');
  lines.push('👉 *DETALHES DO PEDIDO*');
  for (const item of data.items) {
    lines.push(`*${item.quantity}x ${item.productName}* - R$ ${formatMoney(item.unitPrice)}/un`);
  }
  lines.push('');
  lines.push('-------------------------------');
  lines.push('👉 *DADOS DO CLIENTE*');
  lines.push(`Nome: *${data.customerName}*`);
  if (data.customerPhone) {
    lines.push(`Telefone: *${data.customerPhone}*`);
  }
  lines.push('');
  lines.push('-------------------------------');
  lines.push('👉 *VALORES E PAGAMENTO*');
  lines.push(`${data.itemCount} itens: *R$ ${formatMoney(data.subtotal)}*`);
  if (data.discount > 0) {
    lines.push(`Desconto: *-R$ ${formatMoney(data.discount)}*`);
  }
  lines.push(`Forma de pagamento: *${data.paymentMethod}*`);
  lines.push(`Total: *R$ ${formatMoney(data.total)}*`);
  lines.push('');
  lines.push('-------------------------------');
  return lines.join('\n');
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium animate-slide-up ${
      type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
    }`}>
      {message}
    </div>
  );
}

function WhatsAppLink({ phone, message, iconOnly }: { phone: string; message: string; iconOnly?: boolean }) {
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors ${
        iconOnly ? 'p-2' : 'px-3 py-2 text-sm'
      } md:px-3 md:py-2 md:text-sm`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      <span className={iconOnly ? 'hidden md:inline' : ''}>Falar no WhatsApp</span>
    </a>
  );
}

function getLuminance(hex: string | null | undefined): number {
  if (!hex) return 0.3; // default dark
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  // sRGB → linear
  const toLinear = (v: number) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

const LIGHT_THEME_CSS = `
[data-catalog-theme="light"] .bg-slate-950,
[data-catalog-theme="light"] .bg-slate-900 { background-color: #ffffff !important; }
[data-catalog-theme="light"] .bg-slate-800,
[data-catalog-theme="light"] .bg-slate-800\\/50 { background-color: #f8fafc !important; }
[data-catalog-theme="light"] .bg-slate-700 { background-color: #e2e8f0 !important; }
[data-catalog-theme="light"] .bg-slate-950\\/80 { background-color: rgba(255,255,255,0.8) !important; }
[data-catalog-theme="light"] .bg-black\\/60 { background-color: rgba(0,0,0,0.15) !important; }
[data-catalog-theme="light"] .text-white:not(.bg-emerald-500):not(.bg-emerald-600):not(.bg-red-500):not(.bg-\\[var\\(--primary\\)\\]):not(.bg-amber-500\\/20) { color: #0f172a !important; }
[data-catalog-theme="light"] .text-slate-400 { color: #475569 !important; }
[data-catalog-theme="light"] .text-slate-500 { color: #64748b !important; }
[data-catalog-theme="light"] .text-slate-300 { color: #334155 !important; }
[data-catalog-theme="light"] .text-slate-600 { color: #94a3b8 !important; }
[data-catalog-theme="light"] .border-slate-800,
[data-catalog-theme="light"] .border-slate-800\\/50 { border-color: #e2e8f0 !important; }
[data-catalog-theme="light"] .border-slate-700 { border-color: #cbd5e1 !important; }
[data-catalog-theme="light"] .border-slate-600 { border-color: #94a3b8 !important; }
[data-catalog-theme="light"] .placeholder\\:text-slate-500::placeholder { color: #94a3b8 !important; }
[data-catalog-theme="light"] .divide-slate-800 > :not([hidden]) ~ :not([hidden]) { border-color: #e2e8f0 !important; }
[data-catalog-theme="light"] .hover\\:text-white:hover:not(.bg-emerald-500):not(.bg-emerald-600):not(.bg-red-500) { color: #0f172a !important; }
[data-catalog-theme="light"] .hover\\:bg-slate-700:hover:not(.bg-emerald-500):not(.bg-emerald-600) { background-color: #e2e8f0 !important; }
[data-catalog-theme="light"] .hover\\:bg-slate-700\\/50:hover { background-color: #e2e8f0 !important; }
[data-catalog-theme="light"] .hover\\:border-slate-700:hover { border-color: #cbd5e1 !important; }
`;

export default function CatalogPageClient({ slug, store, banners, paymentMethods, categories, products }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [orderResult, setOrderResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState('');

  const cart = useCartStore();
  const show = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type });
  const [searchQuery, setSearchQuery] = useState('');
  const bgColor = store.backgroundColor || '#0f172a';
  const primaryColor = store.primaryColor || '#6366f1';
  const isLight = getLuminance(bgColor) > 0.5;

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.categoryId === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [products, selectedCategory, searchQuery]);

  const outOfStockClass = (product: Product): string => {
    if (product.hasVariations && product.variations.length > 0) {
      return product.variations.every((v) => Number(v.stockQty) <= 0) ? 'opacity-60' : '';
    }
    return Number(product.stockQty) <= 0 ? 'opacity-60' : '';
  };

  const getLowestPrice = (product: Product): number => {
    if (product.hasVariations && product.variations.length > 0) {
      const prices = product.variations.map((v) => Number(v.price ?? product.price));
      return Math.min(...prices);
    }
    return Number(product.price);
  };

  const getImageUrl = (urlPath: string | null): string | null => {
    if (!urlPath) return null;
    // Already a full URL or data URI — use as-is
    if (urlPath.startsWith('http://') || urlPath.startsWith('https://') || urlPath.startsWith('data:')) return urlPath;
    return `${API_URL}/api/public/uploads/${urlPath}`;
  };

  const productImage = (product: Product): string | null => getImageUrl(product.imageUrl);

  const addToCart = () => {
    if (!quickViewProduct) return;
    const variation = quickViewProduct.variations.find((v) => v.id === selectedVariation);
    const price = variation?.price ?? quickViewProduct.price;
    const name = variation
      ? `${quickViewProduct.name} - ${variation.name}`
      : quickViewProduct.name;
    cart.addItem({
      productId: quickViewProduct.id,
      variationId: variation?.id,
      productName: name,
      quantity: qty,
      unitPrice: Number(price),
      total: Number(price) * qty,
    });
    setQuickViewProduct(null);
    setSelectedVariation(null);
    setQty(1);
    show('Produto adicionado ao carrinho!');
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponValidating(true);
    setCouponError('');
    try {
      const result = await api.public.validateCoupon(slug, couponCode.trim(), cart.subtotal());
      if (result.valid) {
        cart.setCoupon({
          code: result.code,
          discountType: result.discountType,
          discountValue: result.discountValue,
          discountAmount: result.discountAmount,
        });
        show(`Cupom aplicado! Desconto: ${formatPrice(result.discountAmount)}`);
      } else {
        cart.setCoupon(null);
        setCouponError(result.error || 'Cupom inválido');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Erro ao validar cupom');
    } finally {
      setCouponValidating(false);
    }
  };

  const submitOrder = async () => {
    if (!cart.paymentMethod) {
      show('Selecione um método de pagamento', 'error');
      return;
    }
    if (!cart.customerName.trim()) {
      show('Informe seu nome', 'error');
      return;
    }
    if (!cart.customerPhone.trim()) {
      show('Informe seu telefone', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.public.createOrder({
        tenantSlug: slug,
        customerName: cart.customerName,
        customerPhone: cart.customerPhone || undefined,
        items: cart.items.map((i) => ({
          productId: i.productId,
          variationId: i.variationId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
        subtotal: cart.subtotal(),
        discount: cart.discount(),
        total: cart.total(),
        paymentMethod: cart.paymentMethod,
        couponCode: cart.coupon?.code,
        couponDiscount: cart.coupon?.discountAmount,
      });

      // Snap cart data before clearing (needed for WhatsApp message)
      const cartSnapshot = {
        items: [...cart.items],
        customerName: cart.customerName,
        customerPhone: cart.customerPhone,
        subtotal: cart.subtotal(),
        discount: cart.discount(),
        total: cart.total(),
        itemCount: cart.itemCount(),
        paymentMethod: cart.paymentMethod,
      };

      setOrderResult(result);
      cart.clearCart();
      setCheckoutOpen(false);

      // Auto-open WhatsApp if store has it enabled
      if (store.receiveWhatsApp && store.whatsAppNumber) {
        const paymentLabel = paymentMethods.find(pm => pm.value === cartSnapshot.paymentMethod)?.label || cartSnapshot.paymentMethod;
        const msg = buildOrderMessage({
          orderNumber: result.order.orderNumber,
          slug,
          items: cartSnapshot.items,
          customerName: cartSnapshot.customerName,
          customerPhone: cartSnapshot.customerPhone,
          subtotal: cartSnapshot.subtotal,
          discount: cartSnapshot.discount,
          total: cartSnapshot.total,
          itemCount: cartSnapshot.itemCount,
          paymentMethod: paymentLabel,
        });
        const cleanPhone = store.whatsAppNumber.replace(/\D/g, '');
        const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
      }

      show('Pedido realizado com sucesso!');
    } catch (err: any) {
      show(err.message || 'Erro ao criar pedido', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Show order confirmation
  if (orderResult) {
    const whatsappMsg = store.receiveWhatsApp && store.whatsAppNumber
      ? (store.postOrderMessage || `Olá ${store.name}, realizei o pedido #${orderResult.order.orderNumber} no valor de ${formatPrice(orderResult.order.total)}.`)
      : '';

    return (
      <div className="min-h-screen flex items-center justify-center p-4" data-catalog-theme={isLight ? 'light' : 'dark'} style={{ backgroundColor: bgColor }}>
        <style>{LIGHT_THEME_CSS}</style>
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Pedido Realizado!</h1>
          <p className="text-slate-400 mb-1">
            Pedido <strong className="text-white">#{orderResult.order.orderNumber}</strong>
          </p>
          <p className="text-slate-400 mb-6">
            Total: <strong className="text-white">{formatPrice(orderResult.order.total)}</strong>
          </p>

          {orderResult.postOrderMessage && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{orderResult.postOrderMessage}</p>
            </div>
          )}

          {whatsappMsg && (
            <div className="mb-6">
              <WhatsAppLink phone={store.whatsAppNumber!} message={whatsappMsg} />
            </div>
          )}

          <button
            onClick={() => setOrderResult(null)}
            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
          >
            Fazer outro pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-catalog-theme={isLight ? 'light' : 'dark'} style={{ backgroundColor: bgColor, '--primary': primaryColor } as React.CSSProperties}>
      <style>{LIGHT_THEME_CSS}</style>
      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-30 backdrop-blur-md border-b border-slate-800/50" style={{ backgroundColor: bgColor + 'cc' }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {store.logoPath ? (
              <img
                src={getImageUrl(store.logoPath) || ''}
                alt={store.name}
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
                <span className="text-[var(--primary)] font-bold text-sm">
                  {store.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-white font-semibold text-sm">{store.name}</h1>
              {store.document && (
                <p className="text-slate-500 text-xs">CNPJ: {store.document}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {store.receiveWhatsApp && store.whatsAppNumber && (
              <WhatsAppLink phone={store.whatsAppNumber} message="Quero fazer um pedido!" iconOnly />
            )}
            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 text-slate-400 hover:text-white transition-colors"
            >
              <ShoppingCart size={20} />
              {cart.itemCount() > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-bold">
                  {cart.itemCount()}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ========== BANNERS ========== */}
      {banners.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div className="flex gap-3 overflow-x-auto pb-2 md:justify-center">
            {banners.map((banner) => {
              const img = (
                <img
                  key={banner.id}
                  src={getImageUrl(banner.imagePath) || ''}
                  alt=""
                  className="h-36 md:h-48 rounded-2xl object-cover flex-shrink-0 w-full md:max-w-2xl"
                />
              );
              return banner.linkUrl ? (
                <a key={banner.id} href={banner.linkUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-full md:flex md:justify-center">
                  {img}
                </a>
              ) : (
                <div key={banner.id} className="flex-shrink-0 w-full md:flex md:justify-center">{img}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== CATEGORIES ========== */}
      {categories.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 mt-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                !selectedCategory
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========== SEARCH ========== */}
      <div className="max-w-5xl mx-auto px-4 mt-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[var(--primary)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ========== PRODUCTS ========== */}
      <main className="max-w-5xl mx-auto px-4 mt-4 pb-24">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">
              {searchQuery ? 'Nenhum produto encontrado.' : 'Nenhum produto nesta categoria.'}
            </p>
          </div>
        ) : (
          <div className={`grid gap-3 ${
            store.displayMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
          }`}>
            {filteredProducts.map((product) => {
              const img = productImage(product);
              const isOut = product.hasVariations && product.variations.length > 0
                ? product.variations.every((v) => Number(v.stockQty) <= 0)
                : Number(product.stockQty) <= 0;

              return (
                <button
                  key={product.id}
                  onClick={() => { setQuickViewProduct(product); setSelectedVariation(null); setQty(1); }}
                  className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden text-left hover:border-slate-700 transition-colors ${
                    isOut && store.outOfStockBehavior !== 'show' ? 'opacity-50' : ''
                  }`}
                >
                  {img ? (
                    <div className="aspect-square bg-slate-800 relative">
                      <img src={img} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-square bg-slate-800 flex items-center justify-center">
                      <ShoppingCart size={32} className="text-slate-600" />
                    </div>
                  )}

                  <div className="p-3">
                    {product.category && (
                      <p className="text-xs text-slate-500 mb-0.5">{product.category.name}</p>
                    )}
                    <h3 className="text-white text-sm font-medium line-clamp-2">{product.name}</h3>

                    <div className="flex items-center gap-2 mt-1.5">
                      {product.hasVariations ? (
                        <p className="text-[var(--primary)] font-semibold text-sm">
                          A partir de {formatPrice(getLowestPrice(product))}
                        </p>
                      ) : (
                        <p className="text-[var(--primary)] font-semibold text-sm">{formatPrice(Number(product.price))}</p>
                      )}

                      {isOut && store.outOfStockBehavior === 'show_disabled' && (
                        <span className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                          Indisponível
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* ========== ACCEPT ORDERS FAB ========== */}
      {store.acceptOrders && cart.itemCount() > 0 && !cartOpen && (
        <div className="fixed bottom-4 left-4 right-4 z-20 md:hidden">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-[var(--primary)] hover:opacity-90 text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[var(--primary)]/25"
          >
            <ShoppingCart size={20} />
            Ver Carrinho ({cart.itemCount()})
            <span className="ml-2">{formatPrice(cart.total())}</span>
          </button>
        </div>
      )}

      {/* Desktop cart sidebar always visible */}
      {store.acceptOrders && cart.itemCount() > 0 && (
        <div className="hidden md:block fixed bottom-4 right-4 z-20">
          <button
            onClick={() => setCartOpen(true)}
            className="bg-[var(--primary)] hover:opacity-90 text-white px-5 py-3 rounded-2xl font-semibold flex items-center gap-2 shadow-lg shadow-[var(--primary)]/25"
          >
            <ShoppingCart size={20} />
            Carrinho ({cart.itemCount()}) — {formatPrice(cart.total())}
          </button>
        </div>
      )}

      {!store.acceptOrders && (
        <div className="max-w-5xl mx-auto px-4 pb-8 text-center">
          <p className="text-slate-500 text-sm">Esta loja não está aceitando pedidos online no momento.</p>
        </div>
      )}

      {/* ========== CART SIDEBAR ========== */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Sidebar */}
          <div className="relative ml-auto w-full max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">
                Carrinho ({cart.itemCount()})
              </h2>
              <button onClick={() => setCartOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {cart.items.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Carrinho vazio</p>
              ) : (
                <>
                  {cart.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{item.productName}</p>
                        <p className="text-[var(--primary)] text-sm font-medium">{formatPrice(item.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => cart.updateQty(item.productId, item.variationId, item.quantity - 1)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-white w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => cart.updateQty(item.productId, item.variationId, item.quantity + 1)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        onClick={() => cart.removeItem(item.productId, item.variationId)}
                        className="p-1 text-red-400 hover:text-red-300"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  {/* Coupon */}
                  <div className="bg-slate-800/50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-2">Cupom de desconto</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Código"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[var(--primary)]"
                      />
                      <button
                        onClick={validateCoupon}
                        disabled={couponValidating || !couponCode.trim()}
                        className="bg-[var(--primary)] hover:opacity-90 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {couponValidating ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar'}
                      </button>
                    </div>
                    {couponError && <p className="text-red-400 text-xs mt-1">{couponError}</p>}
                    {cart.coupon && (
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-emerald-400 text-xs">
                          Cupom {cart.coupon.code} aplicado
                        </p>
                        <button
                          onClick={() => { cart.setCoupon(null); setCouponCode(''); }}
                          className="text-red-400 text-xs hover:text-red-300"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span>
                      <span>{formatPrice(cart.subtotal())}</span>
                    </div>
                    {cart.discount() > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Desconto</span>
                        <span>-{formatPrice(cart.discount())}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-white font-semibold text-base pt-2 border-t border-slate-800">
                      <span>Total</span>
                      <span>{formatPrice(cart.total())}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                    className="w-full bg-[var(--primary)] hover:opacity-90 text-white py-3 rounded-xl font-semibold transition-colors"
                  >
                    Finalizar Pedido
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== CHECKOUT MODAL ========== */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Finalizar Pedido</h2>
              <button onClick={() => setCheckoutOpen(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Nome *</label>
                <input
                  type="text"
                  value={cart.customerName}
                  onChange={(e) => cart.setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[var(--primary)] transition-colors"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">WhatsApp</label>
                <input
                  type="tel"
                  value={cart.customerPhone}
                  onChange={(e) => cart.setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[var(--primary)] transition-colors"
                  placeholder="(11) 99999-9999"
                />
              </div>

              {/* Payment methods */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Método de Pagamento</label>
                <div className="space-y-2">
                  {paymentMethods.map((pm) => (
                    <label
                      key={pm.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        cart.paymentMethod === pm.value
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={pm.value}
                        checked={cart.paymentMethod === pm.value}
                        onChange={() => cart.setPaymentMethod(pm.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        cart.paymentMethod === pm.value ? 'border-[var(--primary)]' : 'border-slate-600'
                      }`}>
                        {cart.paymentMethod === pm.value && (
                          <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                        )}
                      </div>
                      <span className="text-white text-sm">{pm.label}</span>
                      {pm.dueDays && <span className="text-slate-400 text-xs ml-auto">até {pm.dueDays} dias</span>}
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={submitOrder}
                disabled={submitting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                )}
                {submitting ? 'Enviando...' : 'Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== QUICK VIEW MODAL ========== */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-bold text-white pr-4">{quickViewProduct.name}</h2>
              <button onClick={() => setQuickViewProduct(null)} className="text-slate-400 hover:text-white flex-shrink-0">
                <X size={20} />
              </button>
            </div>

            {/* Product image */}
            {quickViewProduct.imageUrl && (
              <div className="aspect-square bg-slate-800 rounded-xl mb-4 overflow-hidden">
                <img
                  src={getImageUrl(quickViewProduct.imageUrl) || ''}
                  alt={quickViewProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {quickViewProduct.description && (
              <p className="text-slate-400 text-sm mb-4">{quickViewProduct.description}</p>
            )}

            {/* Variations — organized by dimension */}
            {quickViewProduct.hasVariations && quickViewProduct.variations.length > 0 && (
              <VariationSelector
                variations={quickViewProduct.variations}
                selectedId={selectedVariation}
                onSelect={setSelectedVariation}
                basePrice={quickViewProduct.price}
              />
            )}

            {/* Price */}
            <div className="flex items-center justify-between mb-4">
              <div>
                {quickViewProduct.hasVariations ? (
                  <p className="text-2xl font-bold text-[var(--primary)]">
                    {selectedVariation
                      ? formatPrice(Number(quickViewProduct.variations.find(v => v.id === selectedVariation)?.price ?? quickViewProduct.price))
                      : `A partir de ${formatPrice(getLowestPrice(quickViewProduct))}`}
                  </p>
                ) : (
                  <p className="text-2xl font-bold text-[var(--primary)]">{formatPrice(Number(quickViewProduct.price))}</p>
                )}
                {/* Stock info */}
                {(quickViewProduct.hasVariations && quickViewProduct.variations.length > 0) ? (
                  selectedVariation && (
                    (() => {
                      const v = quickViewProduct.variations.find(v => v.id === selectedVariation);
                      return v && (
                        <p className={`text-xs ${Number(v.stockQty) > 0 ? 'text-slate-500' : 'text-red-400'}`}>
                          {Number(v.stockQty) > 0 ? `${v.stockQty} em estoque` : 'Sem estoque'}
                        </p>
                      );
                    })()
                  )
                ) : (
                  <p className={`text-xs ${Number(quickViewProduct.stockQty) > 0 ? 'text-slate-500' : 'text-red-400'}`}>
                    {Number(quickViewProduct.stockQty) > 0 ? `${quickViewProduct.stockQty} em estoque` : 'Sem estoque'}
                  </p>
                )}
              </div>
            </div>

            {/* Quantity selector */}
            <div className="flex items-center justify-between mb-4 bg-slate-800/50 rounded-xl p-3">
              <span className="text-slate-400 text-sm">Quantidade</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  disabled={qty <= 1}
                  className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center disabled:opacity-30 transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="text-white font-bold text-lg w-6 text-center">{qty}</span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {store.acceptOrders && (
              <button
                onClick={addToCart}
                disabled={
                  quickViewProduct.hasVariations && quickViewProduct.variations.length > 0
                    ? !selectedVariation
                    : Number(quickViewProduct.stockQty) <= 0
                }
                className="w-full bg-[var(--primary)] hover:opacity-90 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Adicionar ao Carrinho ({qty})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-8">
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* About Us */}
          {store.aboutUs && (
            <div className="mb-6">
              <h3 className="text-white font-semibold text-sm mb-2">Sobre Nós</h3>
              <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">{store.aboutUs}</p>
            </div>
          )}

          {/* Contact links */}
          {(store.phone || store.instagram || store.email) && (
            <div className="flex flex-wrap gap-4 mb-4">
              {store.phone && (
                <a
                  href={`https://wa.me/55${store.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    store.receiveWhatsApp
                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  {store.phone}
                </a>
              )}
              {store.instagram && (
                <a
                  href={store.instagram.startsWith('http') ? store.instagram : `https://instagram.com/${store.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                  {store.instagram.replace('@', '')}
                </a>
              )}
              {store.email && (
                <a
                  href={`mailto:${store.email}`}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  {store.email}
                </a>
              )}
            </div>
          )}

          <p className="text-slate-600 text-xs">
            {store.companyName && `${store.companyName} — `}
            {store.document && `CNPJ ${store.document} — `}
            Powered by Sale360
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// VariationSelector – organized by dimension (Cor → Tamanho)
// ============================================================
function VariationSelector({
  variations,
  selectedId,
  onSelect,
  basePrice,
}: {
  variations: Array<{ id: string; name: string; price?: number | null; priceModifier?: number | string | null; stockQty: number | string }>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  basePrice: number;
}) {
  // Parse variation name into dimensions.
  // Supports both "Cor / Tamanho" (new) and "Tamanho Cor" (legacy) formats.
  const parseDims = (name: string): string[] => {
    // Try " / " separator first (VariationEditor generates this)
    const slashSplit = name.split(' / ').map((s) => s.trim());
    if (slashSplit.length >= 2) return slashSplit;

    // Fallback: space separator (legacy data)
    const spaceSplit = name.split(' ').map((s) => s.trim()).filter(Boolean);
    if (spaceSplit.length >= 2) {
      // First token is dim1, rest is dim2 (handles "10 Verde limão")
      return [spaceSplit[0], spaceSplit.slice(1).join(' ')];
    }
    return spaceSplit;
  };

  const parsed = variations.map((v) => ({
    ...v,
    dims: parseDims(v.name),
  }));

  const dimCount = parsed[0]?.dims.length || 0;
  const allSame = parsed.every((p) => p.dims.length === dimCount);

  // Only group when all variations have exactly 2 dimensions
  if (!allSame || dimCount !== 2) {
    // Fallback: flat list
    return (
      <div className="mb-4">
        <p className="text-slate-400 text-sm mb-2">Selecione:</p>
        <div className="flex flex-wrap gap-2">
          {variations.map((v) => {
            const out = Number(v.stockQty) <= 0;
            return (
              <button
                key={v.id}
                onClick={() => !out && onSelect(v.id === selectedId ? null : v.id)}
                disabled={out}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedId === v.id
                    ? 'bg-[var(--primary)] text-white'
                    : out
                    ? 'bg-slate-800 text-slate-600 line-through cursor-not-allowed'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {v.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Sort helper: numeric sort if all values start with digits, else alphabetical
  const sortValues = (vals: string[]): string[] => {
    const allNumeric = vals.every((v) => /^\d/.test(v));
    if (allNumeric) {
      return vals.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    }
    return vals.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  };

  // Extract unique values for each dimension (sorted)
  const dim1Values = sortValues([...new Set(parsed.map((p) => p.dims[0]))]);
  const dim2Values = sortValues([...new Set(parsed.map((p) => p.dims[1]))]);

  // Smart-label: detect if dim1 is numeric (Tamanho) or text (Cor)
  const dim1IsNumeric = dim1Values.every((v) => /^\d/.test(v));
  const dim2IsNumeric = dim2Values.every((v) => /^\d/.test(v));
  // Only swap labels when dim1 is clearly numeric and dim2 is clearly not
  const swappedLabels = dim1IsNumeric && !dim2IsNumeric;
  const dim1Label = swappedLabels ? 'Tamanho' : 'Cor';
  const dim2Label = swappedLabels ? 'Cor' : 'Tamanho';

  // Build lookup: id → variation
  const byId = new Map(variations.map((v) => [v.id, v]));

  // Find selected variation's dims
  const selectedVar = selectedId ? byId.get(selectedId) : null;
  const selectedDims = selectedVar ? parseDims(selectedVar.name) : null;

  return (
    <div className="mb-4 space-y-3">
      {/* Dimension 1 — horizontal chips */}
      <div>
        <p className="text-slate-500 text-xs mb-1.5 font-medium">{dim1Label}</p>
        <div className="flex flex-wrap gap-1.5">
          {dim1Values.map((d1) => {
            const isActive = selectedDims?.[0] === d1;
            return (
              <button
                key={d1}
                onClick={() => {
                  // If clicking active, clear selection
                  if (isActive) { onSelect(null); return; }
                  // Select first available variation for this value
                  const firstAvail = parsed.find(
                    (p) => p.dims[0] === d1 && Number(p.stockQty) > 0
                  );
                  if (firstAvail) onSelect(firstAvail.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {d1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dimension 2 — shown for selected dim1 */}
      <div>
        <p className="text-slate-500 text-xs mb-1.5 font-medium">{dim2Label}</p>
        <div className="flex flex-wrap gap-1.5">
          {dim2Values.map((d2) => {
            // Only show values available for the selected dim1 (or all if none selected)
            const relevant = selectedDims
              ? parsed.filter((p) => p.dims[0] === selectedDims[0] && p.dims[1] === d2)
              : parsed.filter((p) => p.dims[1] === d2);

            if (relevant.length === 0) {
              // Value not available for this dim1 selection
              return (
                <span
                  key={d2}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/30 text-slate-600 line-through cursor-not-allowed min-w-[2.5rem] text-center"
                >
                  {d2}
                </span>
              );
            }

            const v = relevant[0];
            const out = Number(v.stockQty) <= 0;
            const isSelected = selectedId === v.id;

            return (
              <button
                key={v.id}
                onClick={() => !out && onSelect(isSelected ? null : v.id)}
                disabled={out}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-[2.5rem] ${
                  isSelected
                    ? 'bg-[var(--primary)] text-white'
                    : out
                    ? 'bg-slate-800/50 text-slate-600 line-through cursor-not-allowed'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {d2}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

