import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSandboxMode } from '@/hooks/useSandboxMode';
import { Loader2, TestTube2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function SandboxModeToggle() {
  const { isSandboxActive, loading, updateSandboxMode, isUpdating } = useSandboxMode();
  const { toast } = useToast();

  const handleToggle = async (enabled: boolean) => {
    try {
      updateSandboxMode({ enabled });
      
      toast({
        title: enabled ? 'Sandbox Mode Enabled' : 'Sandbox Mode Disabled',
        description: enabled 
          ? '⚠️ Using TEST Stripe cards. Page will reload to apply changes.'
          : '✅ Using PRODUCTION mode. Page will reload to apply changes.',
      });

      // Reload page after 2 seconds to reinitialize RevenueCat with new key
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      toast({
        title: 'Error updating sandbox mode',
        description: error.message || 'Failed to update sandbox mode',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TestTube2 className="h-5 w-5" />
            Sandbox CC Mode
          </CardTitle>
          <CardDescription className="text-white/70">Test with Stripe test cards (Sandbox API)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TestTube2 className="h-5 w-5" />
          Sandbox CC Mode
        </CardTitle>
        <CardDescription className="text-white/70">Switch between test and production RevenueCat environments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between space-x-4">
          <Label htmlFor="sandbox-mode" className="flex flex-col space-y-1 cursor-pointer">
            <span className="text-sm font-medium leading-none">
              Enable Sandbox Mode
            </span>
            <span className="text-sm text-muted-foreground">
              Use Stripe test cards for testing (4242 4242 4242 4242)
            </span>
          </Label>
          <Switch
            id="sandbox-mode"
            checked={isSandboxActive}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
          />
        </div>

        {isUpdating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating... Page will reload
          </div>
        )}

        {isSandboxActive && (
          <Alert className="bg-orange-500/20 border-orange-500/50 text-white">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Sandbox Mode Active</strong> - Using test environment. Real payments will not be processed.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 space-y-2">
          <h4 className="text-sm font-semibold text-white">Current Mode:</h4>
          <div className="text-sm space-y-1 text-white/90">
            <div className="flex justify-between">
              <span>Environment:</span>
              <span className={`font-medium ${isSandboxActive ? 'text-orange-400' : 'text-green-400'}`}>
                {isSandboxActive ? 'Sandbox (Test)' : 'Production (Live)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>API Key:</span>
              <span className="font-mono text-xs">
                {isSandboxActive ? 'rcb_sb_lq...Lcep' : 'rcb_svn...iNX'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Stripe Cards:</span>
              <span className="font-medium">
                {isSandboxActive ? 'Test Cards Only' : 'Real Cards'}
              </span>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/60 space-y-1">
          <p>• <strong>Sandbox Mode</strong>: Use test cards (4242 4242 4242 4242) - no real charges</p>
          <p>• <strong>Production Mode</strong>: Real payment processing - actual charges</p>
          <p>• Page automatically reloads when switching modes</p>
          <p>• Test purchases in sandbox won't affect production data</p>
        </div>
      </CardContent>
    </Card>
  );
}

