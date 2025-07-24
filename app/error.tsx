'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6 border-red-200 bg-red-50">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="h-8 w-8 text-red-600" />
          <div>
            <h1 className="text-xl font-semibold text-red-800">Application Error</h1>
            <p className="text-sm text-red-600">Something unexpected happened</p>
          </div>
        </div>
        
        <p className="text-red-700 mb-6">
          We're sorry, but the application encountered an error. Please try again or return to the home page.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6">
            <summary className="cursor-pointer text-sm font-medium text-red-800 mb-2">
              Error Details (Development Only)
            </summary>
            <div className="bg-red-100 p-3 rounded border text-xs font-mono text-red-900 overflow-auto">
              <strong>Error:</strong> {error.message}
              {error.digest && (
                <>
                  <br />
                  <strong>Digest:</strong> {error.digest}
                </>
              )}
              <br />
              <strong>Stack:</strong>
              <pre className="mt-2 whitespace-pre-wrap">{error.stack}</pre>
            </div>
          </details>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={reset} className="flex items-center justify-center gap-2 flex-1">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/'}
            className="flex items-center justify-center gap-2 flex-1"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        </div>
      </Card>
    </div>
  );
}