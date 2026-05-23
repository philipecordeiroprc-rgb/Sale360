'use client';

import { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface LegendItem {
  term: string;
  definition: string;
}

export function Legenda({ items }: { items: LegendItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors w-full"
      >
        <Info size={10} />
        <span>Legenda</span>
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && (
        <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
          {items.map((item, i) => (
            <p key={i} className="text-[10px] text-slate-500 leading-relaxed">
              <strong className="text-slate-400">{item.term}</strong>{' '}
              <span className="text-slate-600">= {item.definition}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
