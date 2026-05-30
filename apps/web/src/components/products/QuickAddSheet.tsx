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

// ── VariationSelector (same sorting/grouping logic as catalog) ──

interface VariationItem {
  id: string;
  name: string;
  priceModifier?: number | string | null;
  stockQty: number | string;
}

function VariationSelector({
  variations,
  selectedId,
  onSelect,
  cartItems,
  productId,
  dimensionLabels,
}: {
  variations: any[];
  selectedId: string | null;
  onSelect: (v: any) => void;
  cartItems: any[];
  productId: string;
  dimensionLabels?: string[];
}) {
  // Parse variation name into dimensions (supports "Cor / Tamanho" and legacy "Tamanho Cor")
  const parseDims = (name: string): string[] => {
    const slashSplit = name.split(' / ').map((s) => s.trim());
    if (slashSplit.length >= 2) return slashSplit;

    const spaceSplit = name.split(' ').map((s) => s.trim()).filter(Boolean);
    if (spaceSplit.length >= 2) {
      return [spaceSplit[0], spaceSplit.slice(1).join(' ')];
    }
    return spaceSplit;
  };

  const parsed = variations.map((v: any) => ({
    ...v,
    dims: parseDims(v.name),
  }));

  const dimCount = parsed[0]?.dims.length || 0;
  const allSame = parsed.every((p: any) => p.dims.length === dimCount);

  // Sort helper: numeric if all values start with digits, else alphabetical (pt-BR)
  const sortValues = (vals: string[]): string[] => {
    const allNumeric = vals.every((v) => /^\d/.test(v));
    if (allNumeric) {
      return vals.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    }
    return vals.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  };

  // Get cart count for a variation
  const getCartCount = (vId: string) =>
    cartItems
      .filter((c) => c.productId === productId && c.variationId === vId)
      .reduce((sum: number, c: any) => sum + c.quantity, 0);

  // Render a single variation chip
  const renderChip = (v: any) => {
    const vStock = Number(v.stockQty || 0);
    const vInCart = getCartCount(v.id);
    const vAvailable = vStock - vInCart;
    const outOfStock = vAvailable <= 0;
    const selected = selectedId === v.id;

    return (
      <button
        key={v.id}
        onClick={() => !outOfStock && onSelect(selected ? null : v)}
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
  };

  // Flat list fallback (1 dim or mixed dims)
  if (!allSame || dimCount < 2) {
    // Sort variations by name
    const sorted = [...parsed].sort((a, b) => {
      const aNumeric = /^\d/.test(a.name);
      const bNumeric = /^\d/.test(b.name);
      if (aNumeric && bNumeric) return parseInt(a.name, 10) - parseInt(b.name, 10);
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    return (
      <div>
        <label className="block text-xs text-slate-400 mb-2 font-medium">Variação</label>
        <div className="flex flex-wrap gap-2">
          {sorted.map((v) => renderChip(v))}
        </div>
      </div>
    );
  }

  // Grouped view (exactly 2 dimensions like "Cor / Tamanho")
  const dim1Values = sortValues([...new Set(parsed.map((p: any) => p.dims[0]))]);
  const dim2Values = sortValues([...new Set(parsed.map((p: any) => p.dims[1]))]);

  // Detect dimension type from value patterns
  const detectLabel = (values: string[]): string => {
    if (values.every(v => /^\d+(\.\d+)?\s*(g|kg|mg)$/i.test(v.trim()))) return 'Peso';
    if (values.every(v => /^\d+(\.\d+)?\s*(ml|cl|l)$/i.test(v.trim()))) return 'Volume';
    if (values.every(v => /^\d+$/.test(v.trim()))) return 'Tamanho';
    if (values.every(v => /^(PP|P|M|G|GG|XG|XGG|Único|ÚNICO)$/i.test(v.trim()))) return 'Tamanho';
    const cores = ['vermelho','azul','verde','preto','branco','amarelo','rosa','cinza','marrom','laranja','roxo','bege','bordô','turquesa','dourado','prateado'];
    if (values.every(v => cores.includes(v.toLowerCase().trim()))) return 'Cor';
    if (values.every(v => !/^\d/.test(v.trim()))) return 'Sabor';
    return 'Opção';
  };
  const dim1Label = detectLabel(dim1Values);
  const dim2Label = detectLabel(dim2Values);

  const selectedVar = selectedId ? parsed.find((p: any) => p.id === selectedId) : null;
  const selectedDims = selectedVar ? selectedVar.dims : null;

  return (
    <div className="space-y-3">
      {/* Dimension 1 */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5 font-medium">{dim1Label}</label>
        <div className="flex flex-wrap gap-1.5">
          {dim1Values.map((d1) => {
            const isActive = selectedDims?.[0] === d1;
            return (
              <button
                key={d1}
                onClick={() => {
                  if (isActive) { onSelect(null); return; }
                  const firstAvail = parsed.find(
                    (p: any) => p.dims[0] === d1 && Number(p.stockQty) > 0
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

      {/* Dimension 2 */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5 font-medium">{dim2Label}</label>
        <div className="flex flex-wrap gap-1.5">
          {dim2Values.map((d2) => {
            const relevant = selectedDims
              ? parsed.filter((p: any) => p.dims[0] === selectedDims[0] && p.dims[1] === d2)
              : parsed.filter((p: any) => p.dims[1] === d2);

            if (relevant.length === 0) {
              return (
                <span
                  key={d2}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/30 text-slate-600 line-through cursor-not-allowed"
                >
                  {d2}
                </span>
              );
            }

            const v = relevant[0];
            return renderChip(v);
          })}
        </div>
      </div>
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
          <VariationSelector
            variations={product.variations}
            selectedId={selectedVariation?.id || null}
            onSelect={(v) => setSelectedVariation(v)}
            cartItems={cartItems}
            productId={product.id}
          />
        )}
        {hasVariations && !selectedVariation && (
          <p className="text-xs text-amber-400 mt-1.5">Selecione uma variação</p>
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
