import React, { Component, ErrorInfo, ReactNode } from 'react';
import debug from '@/utils/debug';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    debug.error('❌ Global Error Boundary caught error:', error);
    debug.error('Error stack:', error.stack);
    debug.error('Component stack:', errorInfo.componentStack);
    
    // Also log to console for production debugging
    console.error('[GlobalErrorBoundary] Error caught:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    this.setState({
      error,
      errorInfo,
    });

    // IMPORTANT: Do NOT reload the page automatically
    // This would cause the unprompted reloads users are experiencing
    // Instead, we'll just log the error and show a fallback UI
  }

  public render() {
    if (this.state.hasError) {
      // Show a fallback UI instead of reloading
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
            <p className="text-muted-foreground">
              An unexpected error occurred. Please try refreshing the page manually.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 p-4 bg-muted rounded-md">
                <summary className="cursor-pointer font-semibold">Error Details</summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {this.state.error.toString()}
                  {this.state.error.stack && (
                    <>
                      {'\n\nStack:\n'}
                      {this.state.error.stack}
                    </>
                  )}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                // Only reload if user explicitly clicks
                window.location.reload();
              }}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

