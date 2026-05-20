'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

export function OfflineIndicator({ isOnline, isSyncing, pendingCount }: OfflineIndicatorProps) {
  if (isOnline && !isSyncing && pendingCount === 0) return null;

  if (isSyncing) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px]">
        <RefreshCw size={12} className="animate-spin" />
        <span>Sincronizando...</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px]">
      <WifiOff size={12} />
      <span>Offline</span>
      {pendingCount > 0 && <span>({pendingCount} pendentes)</span>}
    </div>
  );
}
