'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileX, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileX className="h-8 w-8 text-gray-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Page Not Found</h1>
            <p className="text-sm text-gray-600">Error 404</p>
          </div>
        </div>
        
        <p className="text-gray-700 mb-6">
          Sorry, we couldn't find the page you're looking for. The page may have been moved, deleted, or the URL might be incorrect.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex items-center justify-center gap-2 flex-1">
            <Link href="/">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 flex-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </Card>
    </div>
  );
}