'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export function PageTitle() {
  const { tenant } = useAuth();

  useEffect(() => {
    const name = tenant?.companyName;
    document.title = name ? `${name} — Sale360` : 'Sale360 — PDV Inteligente';
  }, [tenant?.companyName]);

  return null;
}
