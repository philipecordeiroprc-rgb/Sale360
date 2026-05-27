'use client';

import { useState } from 'react';
import { BookOpen, Lightbulb } from 'lucide-react';

interface Props {
  manualHtml: string;
  guiasHtml: string;
}

export function TutoriaisClient({ manualHtml, guiasHtml }: Props) {
  const [tab, setTab] = useState<'manual' | 'guias'>('manual');

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tutoriais</h1>
          <p className="text-slate-400 text-sm mt-1">Manual de uso e guias práticos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 mb-4 w-fit">
        <button onClick={() => setTab('manual')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'manual' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
          }`}>
          <BookOpen size={14} className="inline mr-1.5" /> Manual
        </button>
        <button onClick={() => setTab('guias')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'guias' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
          }`}>
          <Lightbulb size={14} className="inline mr-1.5" /> Guias Práticos
        </button>
      </div>

      {/* Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <iframe
          key={tab}
          srcDoc={tab === 'manual' ? manualHtml : guiasHtml}
          className="w-full border-0"
          style={{ height: 'calc(100vh - 180px)' }}
          title={tab === 'manual' ? 'Manual de Uso' : 'Guias Práticos'}
        />
      </div>
    </div>
  );
}
