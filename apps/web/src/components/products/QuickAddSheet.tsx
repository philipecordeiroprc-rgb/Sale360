'use client';

import { useState, useEffect, useMemo } from 'react';
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

// ── VariationPicker (organized by dimension) ──────────────────────
function VariationPicker({
  variations,
  selectedVariation,
  onSelect,
  cartItems,
  productId,
}: {
  variations: any[];
  selectedVariation: any | null;
  onSelect: (v: any) => void;
  cartItems: CartItem[];
  productId: string;
}) {
  // Parse variation name into dimensions
  const parseDims = (name: string): string[] => {
    const slashSplit = name.split(' / ').map((s) => s.trim());
    if (slashSplit.length >= 2) return slashSplit;
    const spaceSplit = name.split(' ').map((s) => s.trim()).filter(Boolean);
    if (spaceSplit.length >= 2) return [spaceSplit[0], spaceSplit.slice(1).join(' ')];
    return spaceSplit;
  };

  const parsed = useMemo(
    () =>
      variations.map((v) => ({
        ...v,
        dims: parseDims(v.name),
        stock: Number(v.stockQty || 0),
        modifier: Number(v.priceModifier || 0),
      })),
    [variations]
  );

  const dimCount = parsed[0]?.dims.length || 0;
  const allSame = parsed.every((p) => p.dims.length === dimCount);

  // Flat fallback
  if (!allSame || dimCount !== 2) {
    return (
      <div>
        <label className="block text-xs text-slate-400 mb-2 font-medium">Variação</label>
        <div className="flex flex-wrap gap-2">
          {variations.map((v: any) => {
            const vStock = Number(v.stockQty || 0);
            const vInCart = cartItems
              .filter((c) => c.productId === productId && c.variationId === v.id)
              .reduce((sum, c) => sum + c.quantity, 0);
            const vAvailable = vStock - vInCart;
            const outOfStock = vAvailable <= 0;
            const selected = selectedVariation?.id === v.id;

            return (
              <button
                key={v.id}
                onClick={() => !outOfStock && onSelect(v)}
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
                {Number(v.priceModifier || 0) > 0 && (
                  <span className="ml-1 opacity-70">(+R$ {Number(v.priceModifier).toFixed(2)})</span>
                )}
                <span className="ml-1 text-[10px] opacity-50">({vStock})</span>
              </button>
            );
          })}
        </div>
        {!selectedVariation && (
          <p className="text-xs text-amber-400 mt-1.5">Selecione uma variação</p>
        )}
      </div>
    );
  }

  // Sort helper
  const sortValues = (vals: string[]): string[] => {
    const allNumeric = vals.every((v) => /^\d/.test(v));
    if (allNumeric) return vals.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    return vals.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  };

  const dim1Values = sortValues([...new Set(parsed.map((p) => p.dims[0]))]);
  const dim2Values = sortValues([...new Set(parsed.map((p) => p.dims[1]))]);

  const dim1IsNumeric = dim1Values.every((v) => /^\d/.test(v));
  const dim2IsNumeric = dim2Values.every((v) => /^\d/.test(v));
  const swappedLabels = dim1IsNumeric && !dim2IsNumeric;
  const dim1Label = swappedLabels ? 'Tamanho' : 'Cor';
  const dim2Label = swappedLabels ? 'Cor' : 'Tamanho';

  const selectedDims = selectedVariation ? parseDims(selectedVariation.name) : null;

  // Get in-cart count for a variation
  const getInCart = (vid: string) =>
    cartItems.filter((c) => c.productId === productId && c.variationId === vid).reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="space-y-3">
      {/* Dimension 1 */}
      <div>
        <p className="text-slate-500 text-xs mb-1.5 font-medium">{dim1Label}</p>
        <div className="flex flex-wrap gap-1.5">
          {dim1Values.map((d1) => {
            const isActive = selectedDims?.[0] === d1;
            return (
              <button
                key={d1}
                onClick={() => {
                  if (isActive) { onSelect(null); return; }
                  const firstAvail = parsed.find(
                    (p) => p.dims[0] === d1 && p.stock - getInCart(p.id) > 0
                  );
                  if (firstAvail) onSelect(firstAvail);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {d1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dimension 2 — filtered by selected dim1 */}
      {selectedDims && (
        <div>
          <p className="text-slate-500 text-xs mb-1.5 font-medium">{dim2Label}</p>
          <div className="flex flex-wrap gap-1.5">
            {dim2Values.map((d2) => {
              const relevant = parsed.filter(
                (p) => p.dims[0] === selectedDims[0] && p.dims[1] === d2
              );

              if (relevant.length === 0) {
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
              const inCart = getInCart(v.id);
              const available = v.stock - inCart;
              const out = available <= 0;
              const isSelected = selectedVariation?.id === v.id;

              return (
                <button
                  key={v.id}
                  onClick={() => !out && onSelect(isSelected ? null : v)}
                  disabled={out}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-[2.5rem] ${
                    isSelected
                      ? 'bg-indigo-500 text-white'
                      : out
                        ? 'bg-slate-800/50 text-slate-600 line-through cursor-not-allowed'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {d2}
                  {v.modifier > 0 && (
                    <span className="ml-0.5 opacity-75 text-[10px]">+R${v.modifier.toFixed(2)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!selectedVariation && (
        <p className="text-xs text-amber-400">Selecione uma variação</p>
      )}
    </div>
  );
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

        {/* Variations — organized by dimension */}
        {hasVariations && (
          <VariationPicker
            variations={product.variations}
            selectedVariation={selectedVariation}
            onSelect={setSelectedVariation}
            cartItems={cartItems}
            productId={product.id}
          />
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
