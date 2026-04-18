'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Avoid hard dependency on Sentry runtime in local dev where vendor-chunks can be unstable.
    console.error('GlobalError captured:', error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md text-center space-y-4">
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            We hit an unexpected issue. Please try again.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
