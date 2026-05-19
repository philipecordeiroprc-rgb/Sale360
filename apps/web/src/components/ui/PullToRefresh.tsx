'use client';

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 60;
const MAX_PULL = 100;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (refreshing) return;
    // Only allow pull when page is scrolled to the very top
    if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return;
    // Only single-touch
    if (e.touches.length > 1) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff <= 0) {
      setPullDistance(0);
      return;
    }
    // Apply resistance
    setPullDistance(Math.min(diff * 0.4, MAX_PULL));
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(0);
      router.refresh();
      await new Promise((r) => setTimeout(r, 800));
      setRefreshing(false);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, router]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <>
      {/* Pull indicator — fixed at top of viewport */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="fixed top-12 md:top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
          style={{ transform: `translateY(${refreshing ? 16 : pullDistance * 0.6}px)` }}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/90 backdrop-blur border border-slate-700 shadow-lg">
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
    </>
  );
}
