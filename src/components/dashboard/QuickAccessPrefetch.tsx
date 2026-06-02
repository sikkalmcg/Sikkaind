'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface QuickAccessPrefetchProps {
  tcode: string;
}

export function QuickAccessPrefetch({ tcode }: QuickAccessPrefetchProps) {
  const router = useRouter();
  
  React.useEffect(() => {
    const routeMap: Record<string, string> = {
      'OX': '/dashboard/ox',
      'FM': '/dashboard/fm',
      'XK': '/dashboard/xk',
      'XD': '/dashboard/xd',
      'VA': '/dashboard/va',
      'SU': '/dashboard/su',
      'TR21': '/dashboard/tr21',
      'TR24': '/dashboard/tr24',
      'WGPS24': '/dashboard/wgsp24',
      'SE38': '/dashboard/se38',
      'ZCODE': '/dashboard/zcode'
    };
    
    const baseCode = ['ZCODE', 'SE38', 'WGPS24', 'TR21', 'TR24'].includes(tcode) 
      ? tcode 
      : tcode.substring(0, 2);
    
    const targetRoute = routeMap[baseCode];
    if (targetRoute) {
      router.prefetch(`${targetRoute}?tcode=${tcode}`);
    }
  }, [tcode, router]);
  
  return null;
}
