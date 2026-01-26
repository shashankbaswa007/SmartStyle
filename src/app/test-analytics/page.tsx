'use client';

import { useMounted } from '@/hooks/useMounted';

export default function TestPage() {
  const mounted = useMounted();

  if (!mounted) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Page - No Recharts</h1>
      <p>This page has no charts and should load fine.</p>
    </div>
  );
}
