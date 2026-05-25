'use client';

import { useState, useEffect } from 'react';
import { Plus, Minus, Package } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface CartItem {
  productId?: string;
  variationId?: string;
  variationName?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface QuickAddSheetProps {
  open: boolean;
  product: any | null;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
  cartItems: CartItem[];
}

export function QuickAddSheet({ open, product, onClose, onAdd, cartItems }: QuickAddSheetProps) {
  const [selectedVariation, setSelectedVariation] = useState<any>(null);
  const [qty, setQty] = useState('1');

  // Reset state when product changes or modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedVariation(null);
      setQty('1');
    }
  }, [open, product?.id]);

  if (!product) return null;

  const hasVariations = product.hasVariations && product.variations?.length > 0;
  const isFractional = product.isFractional;
  const step = isFractional ? 0.1 : 1;
  const minQty = isFractional ? 0.1 : 1;

  // Price with variation modifier
  const basePrice = Number(product.price || 0);
  const priceModifier = hasVariations && selectedVariation ? Number(selectedVariation.priceModifier || 0) : 0;
  const unitPrice = basePrice + priceModifier;

  // Available stock
  const getAvailableStock = (): number => {
    if (hasVariations) {
      if (!selectedVariation) return 0;
      return Number(selectedVariation.stockQty || 0);
    }
    return Number(product.stockQty || 0);
  };

  // Already in cart for this product+variation
  const getAlreadyInCart = (): number =>
    cartItems
      .filter(
        (c) =>
          c.productId === product.id &&
          c.variationId === (selectedVariation?.id || undefined)
      )
      .reduce((sum, c) => sum + c.quantity, 0);

  const available = getAvailableStock();
  const alreadyInCart = getAlreadyInCart();
  const remaining = available - alreadyInCart;
  const numericQty = parseFloat(qty) || 0;
  const canAdd = numericQty >= minQty && numericQty <= remaining && (!hasVariations || selectedVariation);

  const handleQtyChange = (value: string) => {
    // Allow empty or partial input
    if (value === '' || value === '-') {
      setQty(value);
      return;
    }
    const n = parseFloat(value);
    if (isNaN(n)) return;
    setQty(value);
  };

  const adjustQty = (delta: number) => {
    const current = parseFloat(qty) || 0;
    const next = Math.max(minQty, Math.min(remaining, current + delta));
    setQty(isFractional ? next.toFixed(1) : String(Math.floor(next)));
  };

  const handleAdd = () => {
    const finalQty = parseFloat(qty) || minQty;
    if (finalQty < minQty || finalQty > remaining) return;
    if (hasVariations && !selectedVariation) return;

    const itemName = hasVariations && selectedVariation
      ? `${product.name} - ${selectedVariation.name}`
      : product.name;

    onAdd({
      productId: product.id,
      variationId: selectedVariation?.id || undefined,
      variationName: selectedVariation?.name,
      productName: itemName,
      quantity: finalQty,
      unitPrice,
      total: finalQty * unitPrice,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="" size="sm" closeOnOverlayClick={false}>
      <div className="space-y-4">
        {/* Product image placeholder */}
        <div className="h-40 sm:h-48 bg-slate-800 rounded-xl flex items-center justify-center">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Package size={40} className="text-slate-600" />
              <span className="text-sm text-slate-500">{product.name}</span>
            </div>
          )}
        </div>

        {/* Name & Price */}
        <div>
          <h3 className="text-lg font-semibold text-white">{product.name}</h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-emerald-400">
              R$ {unitPrice.toFixed(2)}
            </span>
            {priceModifier > 0 && (
              <span className="text-xs text-slate-400">(+R$ {priceModifier.toFixed(2)})</span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Estoque: {available} disponíveis
            {alreadyInCart > 0 && (
              <span className="ml-2 text-indigo-400">
                ({alreadyInCart} já no carrinho)
              </span>
            )}
          </p>
        </div>

        {/* Variations */}
        {hasVariations && (
          <div>
            <label className="block text-xs text-slate-400 mb-2 font-medium">Variação</label>
            <div className="flex flex-wrap gap-2">
              {product.variations.map((v: any) => {
                const vStock = Number(v.stockQty || 0);
                const vInCart = cartItems.filter(
                  (c) => c.productId === product.id && c.variationId === v.id
                ).reduce((sum, c) => sum + c.quantity, 0);
                const vAvailable = vStock - vInCart;
                const outOfStock = vAvailable <= 0;
                const selected = selectedVariation?.id === v.id;

                return (
                  <button
                    key={v.id}
                    onClick={() => !outOfStock && setSelectedVariation(v)}
                    disabled={outOfStock}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-indigo-500 text-white'
                        : outOfStock
                          ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed line-through'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {v.name}
                    {v.priceModifier > 0 && (
                      <span className="ml-1 opacity-70">(+R$ {Number(v.priceModifier).toFixed(2)})</span>
                    )}
                    <span className="ml-1 text-[10px] opacity-50">({vStock})</span>
                  </button>
                );
              })}
            </div>
            {hasVariations && !selectedVariation && (
              <p className="text-xs text-amber-400 mt-1.5">Selecione uma variação</p>
            )}
          </div>
        )}

        {/* Quantity */}
        <div>
          <label className="block text-xs text-slate-400 mb-2 font-medium">Quantidade</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjustQty(-step)}
              disabled={numericQty <= minQty}
              className="w-10 h-10 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <Minus size={18} />
            </button>
            <input
              type="number"
              value={qty}
              onChange={(e) => handleQtyChange(e.target.value)}
              onBlur={() => {
                const n = parseFloat(qty);
                if (!qty || isNaN(n) || n < minQty) setQty(String(minQty));
                if (n > remaining) setQty(String(remaining));
              }}
              step={step}
              min={minQty}
              max={remaining}
              className="w-20 text-center px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-lg font-semibold focus:border-indigo-500 outline-none"
            />
            <button
              onClick={() => adjustQty(step)}
              disabled={numericQty >= remaining}
              className="w-10 h-10 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <Plus size={18} />
            </button>
            <span className="text-xs text-slate-500">
              {remaining > 0 ? `máx. ${remaining}` : 'Sem estoque'}
            </span>
          </div>
        </div>

        {/* Add button */}
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
        >
          {remaining <= 0
            ? 'Produto sem estoque'
            : `Adicionar ao Carrinho — R$ ${(numericQty * unitPrice).toFixed(2)}`}
        </button>
      </div>
    </Modal>
  );
}
