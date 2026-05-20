'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Scan, Keyboard } from 'lucide-react';
import api from '@/lib/api';

interface BarcodeScannerProps {
  onDetected: (product: any) => void;
  onError: (message: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onError, isOpen, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const usbInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'error' | 'notfound'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [scannedCode, setScannedCode] = useState('');

  // Camera scanner
  useEffect(() => {
    if (!isOpen) return;

    const scannerId = 'barcode-scanner-viewport';
    let scanner: Html5Qrcode | null = null;
    let stopped = false;

    const startCamera = async () => {
      try {
        scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        setStatus('loading');
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777,
          },
          async (decodedText) => {
            if (stopped) return;
            setScannedCode(decodedText);
            await lookupBarcode(decodedText);
          },
          () => {
            // scan failure per frame — ignore
          }
        );
        if (!stopped) setStatus('scanning');
      } catch (err: any) {
        if (stopped) return;
        const msg = err?.message || String(err);
        if (msg.includes('NotAllowed') || msg.includes('permission')) {
          setErrorMsg('Permissão de câmera negada. Use o input manual ou libere nas configurações do navegador.');
        } else if (msg.includes('NotFound') || msg.includes('no cameras')) {
          setErrorMsg('Nenhuma câmera encontrada neste dispositivo.');
        } else {
          setErrorMsg(`Erro ao iniciar câmera: ${msg}`);
        }
        setStatus('error');
      }
    };

    const lookupBarcode = async (code: string) => {
      try {
        const product = await api.products.getByBarcode(code);
        if (!stopped) {
          stopScanner();
          onDetected(product);
        }
      } catch {
        if (!stopped) {
          setStatus('notfound');
          setErrorMsg(`Produto não encontrado para o código: ${code}`);
        }
      }
    };

    const stopScanner = async () => {
      if (scanner && scanner.isScanning) {
        try {
          await scanner.stop();
        } catch {}
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(startCamera, 200);

    // Stop on tab visibility change
    const handleVisibility = () => {
      if (document.hidden && scanner && scanner.isScanning) {
        scanner.stop().catch(() => {});
      } else if (!document.hidden && scanner && !scanner.isScanning && !stopped) {
        startCamera();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (scanner) {
        scanner.stop().catch(() => {});
        scanner.clear();
      }
    };
  }, [isOpen]);

  // Focus USB input when opened
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      usbInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleUsbInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const code = (e.target as HTMLInputElement).value.trim();
      if (!code) return;
      (e.target as HTMLInputElement).value = '';
      setScannedCode(code);
      try {
        const product = await api.products.getByBarcode(code);
        onDetected(product);
      } catch {
        setStatus('notfound');
        setErrorMsg(`Produto não encontrado para o código: ${code}`);
      }
    }
  };

  const retry = () => {
    setStatus('loading');
    setErrorMsg('');
    setScannedCode('');
    // Re-trigger camera by toggling
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    // Force re-mount of camera view
    setTimeout(() => {
      const viewport = document.getElementById('barcode-scanner-viewport');
      if (viewport) viewport.innerHTML = '';
      // Restart via effect re-trigger
      setStatus('loading');
    }, 50);
  };

  if (!isOpen) return null;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Scan size={16} className="text-indigo-400" />
          <span className="text-sm font-medium text-white">Leitor de Código de Barras</span>
        </div>
        <button
          onClick={() => {
            if (scannerRef.current) {
              scannerRef.current.stop().catch(() => {});
              scannerRef.current.clear();
            }
            onClose();
          }}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Camera viewport */}
      <div id="barcode-scanner-viewport" className="w-full aspect-video bg-slate-950 relative" />

      {/* Hidden USB scanner input */}
      <input
        ref={usbInputRef}
        type="text"
        inputMode="none"
        autoFocus
        onKeyDown={handleUsbInput}
        className="absolute -left-[9999px] opacity-0 w-0 h-0"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Status overlay */}
      {status === 'loading' && (
        <div className="px-4 py-6 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Acessando câmera...</p>
        </div>
      )}

      {status === 'scanning' && (
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <p className="text-xs text-slate-500">
            Aponte para o código de barras ou use o leitor USB
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="px-4 py-4 flex flex-col items-center gap-3">
          <Camera size={24} className="text-red-400" />
          <p className="text-sm text-red-400 text-center">{errorMsg}</p>
          <div className="flex gap-2">
            <button
              onClick={retry}
              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Tentar novamente
            </button>
          </div>
          <p className="text-xs text-slate-500 text-center">
            Ou use o leitor USB — o input já está ativo
          </p>
        </div>
      )}

      {status === 'notfound' && (
        <div className="px-4 py-4 flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center">
            <Scan size={20} className="text-amber-400" />
          </div>
          <p className="text-sm text-amber-400">{errorMsg}</p>
          {scannedCode && (
            <p className="text-xs text-slate-500 font-mono bg-slate-800 px-3 py-1.5 rounded-md">{scannedCode}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={retry}
              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Escanear novamente
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* USB indicator */}
      <div className="px-4 py-2 border-t border-slate-800 flex items-center gap-2 text-[10px] text-slate-600">
        <Keyboard size={10} />
        Leitor USB ativo — escaneie ou digite o código e pressione Enter
      </div>
    </div>
  );
}
