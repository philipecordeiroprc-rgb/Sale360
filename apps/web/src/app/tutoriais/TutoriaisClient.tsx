'use client';

import { Lightbulb } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
  guiasHtml: string;
}

export function TutoriaisClient({ guiasHtml }: Props) {
  // Blob URL gives the iframe its own origin so anchor links (#section) stay inside the iframe
  const blobUrl = useMemo(() => {
    const blob = new Blob([guiasHtml], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [guiasHtml]);

  return (
    <div className="animate-slide-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tutoriais</h1>
          <p className="text-slate-400 text-sm mt-1">Guias práticos passo a passo</p>
        </div>
      </div>

      {/* Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <iframe
          src={blobUrl}
          className="w-full border-0"
          style={{ height: 'calc(100vh - 180px)' }}
          title="Guias Práticos"
        />
      </div>
    </div>
  );
}
