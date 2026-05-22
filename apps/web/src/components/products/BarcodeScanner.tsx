'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Scan, Keyboard, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

interface BarcodeScannerProps {
  onDetected: (product: any) => void;
  onError: (message: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onError, isOpen, onClose }: BarcodeScannerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const usbInputRef = useRef<HTMLInputElement | null>(null);
  const stoppedRef = useRef(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus] = useState<'loading' | 'scanning' | 'error' | 'notfound'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [scannedCode, setScannedCode] = useState('');

  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;

  const classifyError = useCallback((err: any): string => {
    const msg = err?.message || String(err);

    // Check for secure context / HTTPS first
    if (!isSecureContext) {
      return 'Este site não está servido em HTTPS. O acesso à câmera exige uma conexão segura (HTTPS ou localhost).' +
        '\n\nSoluções:\n• Acesse via localhost no desenvolvimento\n• Configure HTTPS no servidor de produção';
    }

    if (msg.includes('NotAllowed') || msg.includes('Permission') || msg.includes('permission')) {
      return 'Permissão de câmera negada. Libere o acesso à câmera nas configurações do navegador e tente novamente.';
    }
    if (msg.includes('NotFound') || msg.includes('no cameras') || msg.includes('No camera')) {
      return 'Nenhuma câmera encontrada neste dispositivo. Use o input manual para códigos de barras.';
    }
    if (msg.includes('NotReadable') || msg.includes('not readable') || msg.includes('in use')) {
      return 'Não foi possível acessar a câmera. Verifique se outro aplicativo está usando a câmera e tente novamente.';
    }
    if (msg.includes('streaming') || msg.includes('Streaming') || msg.includes('not supported')) {
      return `Falha ao iniciar o streaming da câmera.\n\nCausas comuns:\n• Site não está em HTTPS (atual: ${window.location.protocol}//)\n• Navegador não suporta acesso à câmera\n• Câmera já em uso por outro app\n• Driver de câmera ausente no dispositivo`;
    }

    return `Erro ao iniciar câmera: ${msg}`;
  }, [isSecureContext]);

  const lookupBarcode = useCallback(async (code: string) => {
    try {
      const product = await api.products.getByBarcode(code);
      if (!stoppedRef.current) {
        // Stop scanner before calling onDetected
        if (scannerRef.current?.isScanning) {
          await scannerRef.current.stop().catch(() => {});
        }
        onDetected(product);
      }
    } catch {
      if (!stoppedRef.current) {
        setStatus('notfound');
        setErrorMsg(`Produto não encontrado para o código: ${code}`);
      }
    }
  }, [onDetected]);

  // Camera lifecycle
  useEffect(() => {
    if (!isOpen) return;

    stoppedRef.current = false;

    const startCamera = async () => {
      // Wait for viewport element to be visible with dimensions
      const viewport = viewportRef.current;
      if (!viewport) {
        if (!stoppedRef.current) {
          retryTimerRef.current = setTimeout(startCamera, 100);
        }
        return;
      }

      const rect = viewport.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Element exists but has no size yet (animation still running)
        if (!stoppedRef.current) {
          retryTimerRef.current = setTimeout(startCamera, 150);
        }
        return;
      }

      // Clear any pending retry
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }

      try {
        const scanner = new Html5Qrcode('barcode-scanner-viewport');
        scannerRef.current = scanner;

        setStatus('loading');
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              // Dynamic qrbox based on actual viewport size
              const boxSize = Math.min(viewfinderWidth, viewfinderHeight) * 0.7;
              return { width: Math.floor(boxSize), height: Math.floor(boxSize * 0.6) };
            },
            aspectRatio: 1.777,
          },
          async (decodedText) => {
            if (stoppedRef.current) return;
            setScannedCode(decodedText);
            await lookupBarcode(decodedText);
          },
          () => {
            // scan failure per frame — ignore
          }
        );
        if (!stoppedRef.current) setStatus('scanning');
      } catch (err: any) {
        if (stoppedRef.current) return;
        const msg = classifyError(err);
        setErrorMsg(msg);
        setStatus('error');
      }
    };

    // Initial delay to let the modal animation complete (200ms animation + buffer)
    const initialTimer = setTimeout(startCamera, 300);

    // Pause scanner when tab is hidden, resume when visible
    const handleVisibility = () => {
      const scanner = scannerRef.current;
      if (!scanner) return;
      if (document.hidden && scanner.isScanning) {
        scanner.stop().catch(() => {});
      } else if (!document.hidden && !scanner.isScanning && !stoppedRef.current) {
        startCamera();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stoppedRef.current = true;
      clearTimeout(initialTimer);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibility);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, [isOpen, classifyError, lookupBarcode]);

  // Focus USB input when opened
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      usbInputRef.current?.focus();
    }, 500); // Longer delay to account for modal animation
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleUsbInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const input = e.target as HTMLInputElement;
      const code = input.value.trim();
      if (!code) return;
      input.value = '';
      setScannedCode(code);
      // Stop camera if running (USB takes priority)
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop().catch(() => {});
      }
      await lookupBarcode(code);
    }
  };

  const retry = () => {
    setStatus('loading');
    setErrorMsg('');
    setScannedCode('');
    stoppedRef.current = false;

    // Clean up previous scanner instance
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }

    // Clear viewport and restart
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.innerHTML = '';
    }

    // Delay to let DOM settle
    setTimeout(() => {
      if (!stoppedRef.current) {
        // Trigger camera restart by re-rendering status
        setStatus('loading');
      }
    }, 100);

    // The main effect will pick up the new status and restart
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
            stoppedRef.current = true;
            if (scannerRef.current) {
              scannerRef.current.stop().catch(() => {});
              scannerRef.current.clear();
              scannerRef.current = null;
            }
            onClose();
          }}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Secure context warning */}
      {!isSecureContext && (
        <div className="mx-4 mt-3 px-3 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-300 font-medium">HTTPS necessário para câmera</p>
            <p className="text-[10px] text-amber-400/70 mt-0.5">
              O navegador bloqueia a câmera em sites HTTP. Use o leitor USB (input já ativo) ou acesse via HTTPS.
            </p>
          </div>
        </div>
      )}

      {/* Camera viewport */}
      <div
        ref={viewportRef}
        id="barcode-scanner-viewport"
        className="w-full aspect-video bg-slate-950 relative"
      />

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
          <p className="text-sm text-red-400 text-center whitespace-pre-line">{errorMsg}</p>
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
