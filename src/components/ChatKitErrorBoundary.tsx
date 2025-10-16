import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class ChatKitErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorCount: 0,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorCount: 0 };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ ChatKit Error Boundary caught error:', error, errorInfo);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1
    }));
  }

  private handleReset = () => {
    console.log('🔄 Resetting ChatKit Error Boundary');
    this.setState({ hasError: false, error: null });
    // Refresh the page as a last resort
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-4">
              <div>
                <p className="font-semibold mb-2">ChatKit Error</p>
                <p className="text-sm mb-2">{this.state.error?.message || 'Unknown error occurred'}</p>
                <p className="text-xs text-muted-foreground">
                  {this.state.errorCount > 1 
                    ? 'Multiple errors detected. Please refresh the page.'
                    : 'Check browser console for details.'}
                </p>
              </div>
              <Button
                onClick={this.handleReset}
                className="flex items-center gap-2 mx-auto"
                variant="default"
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Page
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

