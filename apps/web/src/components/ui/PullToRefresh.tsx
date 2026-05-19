'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  children: React.ReactNode;
  /** If true, disable pull-to-refresh (e.g. on pages with modals) */
  disabled?: boolean;
}

const THRESHOLD = 60; // px to pull before trigger
const MAX_PULL = 100; // max pull distance

export function PullToRefresh({ children, disabled }: PullToRefreshProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || refreshing) return;
    // Only allow pull when at the very top
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff <= 0) {
      setPullDistance(0);
      return;
    }
    // Apply resistance — the further you pull, the harder it gets
    const resisted = Math.min(diff * 0.4, MAX_PULL);
    setPullDistance(resisted);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(0);
      // Refresh the current route — this re-renders page components
      router.refresh();
      // Small delay so user sees the spinner
      await new Promise((r) => setTimeout(r, 800));
      setRefreshing(false);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, router]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Pull indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
          style={{ transform: `translateY(${refreshing ? 50 : pullDistance - 30}px)`, transition: refreshing ? 'none' : undefined }}
        >
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/90 backdrop-blur border border-slate-700 shadow-lg ${
            refreshing ? 'opacity-100' : ''
          }`}>
            <RefreshCw
              size={16}
              className={`text-indigo-400 ${refreshing ? 'animate-spin' : ''}`}
              style={{
                transform: refreshing ? undefined : `rotate(${Math.min(pullDistance / THRESHOLD * 360, 360)}deg)`,
              }}
            />
            <span className="text-xs text-slate-300">
              {refreshing ? 'Atualizando...' : pullDistance >= THRESHOLD ? 'Solte para atualizar' : 'Puxe para atualizar'}
            </span>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
