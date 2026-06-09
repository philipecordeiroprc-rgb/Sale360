'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, MoveVertical } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface BannerUploadModalProps {
  open: boolean;
  onClose: () => void;
  file: File | null;
  onUpload: (file: File, positionY: number) => Promise<void>;
}

export function BannerUploadModal({ open, onClose, file, onUpload }: BannerUploadModalProps) {
  const [positionY, setPositionY] = useState(50);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setPositionY(50);
      return () => URL.revokeObjectURL(url);
    }
  }, [open, file]);

  const handleDragMove = useCallback(
    (clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeY = (clientY - rect.top) / rect.height;
      const clamped = Math.max(0, Math.min(100, Math.round(relativeY * 100)));
      setPositionY(clamped);
    },
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragMove(e.clientY);
    setDragActive(true);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragActive) return;
      handleDragMove(e.clientY);
    },
    [dragActive, handleDragMove]
  );

  const handleMouseUp = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!dragActive) return;
      handleDragMove(e.touches[0].clientY);
    },
    [dragActive, handleDragMove]
  );

  useEffect(() => {
    if (dragActive) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [dragActive, handleMouseMove, handleMouseUp, handleTouchMove]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file, positionY);
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setUploading(false);
    }
  };

  if (!file || !previewUrl) return null;

  return (
    <Modal open={open} onClose={onClose} title="Ajustar posição do banner" size="md">
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Arraste a imagem verticalmente dentro da máscara para ajustar o enquadramento.
          A faixa horizontal (4:1) é como o banner aparecerá na loja.
        </p>

        {/* Preview with mask */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={(e) => {
            setDragActive(true);
            handleDragMove(e.touches[0].clientY);
          }}
          className="relative aspect-[4/1] rounded-xl overflow-hidden border-2 border-indigo-500/50 cursor-ns-resize select-none bg-slate-950"
        >
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-cover pointer-events-none"
            style={{ objectPosition: `50% ${positionY}%` }}
            draggable={false}
          />
          {/* Mask overlay — shows the visible area */}
          <div className="absolute inset-0 border-2 border-indigo-400 rounded-xl pointer-events-none shadow-[inset_0_0_0_1000px_rgba(0,0,0,0.15)]" />

          {/* Center crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full border-2 border-white/40 flex items-center justify-center">
              <MoveVertical size={14} className="text-white/60" />
            </div>
          </div>

          {/* Position indicator */}
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none">
            Centro: {positionY}%
          </div>
        </div>

        {/* Vertical position slider */}
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block font-medium">
            Posição vertical: {positionY}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={positionY}
            onChange={(e) => setPositionY(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
            <span>Topo</span>
            <span>Centro</span>
            <span>Fundo</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? 'Enviando...' : 'Confirmar e Enviar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
