'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @fileOverview Redundant tracking sub-page neutralized.
 */
export default function NeutralizedPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/trip-board');
  }, [router]);

  return null;
}
