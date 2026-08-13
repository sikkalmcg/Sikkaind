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
      // Vehicle Management Exact Routes
      'VT01': '/dashboard/vt01',
      'VT02': '/dashboard/vt02',
      'VT03': '/dashboard/vt03',
      'VT04': '/dashboard/vt04',
      'VT11': '/dashboard/vt11',

      // Freight Rates
      'VK11': '/dashboard/vk11',
      'VK12': '/dashboard/vk12',
      'VK13': '/dashboard/vk13',

      // Forwarding Agents
      'MK01': '/dashboard/mk01',
      'MK02': '/dashboard/mk02',
      'MK03': '/dashboard/mk03',

      // Base Code Mappings
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

    const c = tcode.toUpperCase().trim();

    // Check exact T-Code first (for multi-digit routes like VT01, VT02, etc.)
    let targetRoute = routeMap[c];

    // If not found in exact routes, fallback to base code mapping
    if (!targetRoute) {
      const baseCode = ['ZCODE', 'SE38', 'WGPS24', 'TR21', 'TR24'].includes(c)
        ? c
        : c.substring(0, 2);

      targetRoute = routeMap[baseCode] || `/dashboard/${baseCode.toLowerCase()}`;
    }

    if (targetRoute) {
      router.prefetch(`${targetRoute}?tcode=${c}`);
    }
  }, [tcode, router]);

  return null;
}