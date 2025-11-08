import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSandboxMode } from '@/hooks/useSandboxMode';
import { Loader2, TestTube2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function SandboxModeToggle() {
  const { isSandboxActive, loading, updateSandboxMode, isUpdating } = useSandboxMode();
  const { toast } = useToast();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingSandboxMode, setPendingSandboxMode] = useState<boolean | null>(null);

  const handleToggle = (enabled: boolean) => {
    setPendingSandboxMode(enabled);
    setConfirmDialogOpen(true);
  };

  const confirmToggle = async () => {
    if (pendingSandboxMode === null) return;
    
    try {
      updateSandboxMode({ enabled: pendingSandboxMode });
      
      toast({
        title: pendingSandboxMode ? 'Sandbox Mode Enabled' : 'Sandbox Mode Disabled',
        description: pendingSandboxMode 
          ? '⚠️ Using TEST Stripe cards. Page will reload to apply changes.'
          : '✅ Using PRODUCTION mode. Page will reload to apply changes.',
      });

      setConfirmDialogOpen(false);
      setPendingSandboxMode(null);

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
      setConfirmDialogOpen(false);
      setPendingSandboxMode(null);
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
          {isSandboxActive ? (
            <Badge className="bg-orange-500 text-white ml-2">TEST MODE</Badge>
          ) : (
            <Badge className="bg-green-600 text-white ml-2">PRODUCTION</Badge>
          )}
        </CardTitle>
        <CardDescription className="text-white/70">Switch between test and production RevenueCat environments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between space-x-4">
          <Label htmlFor="sandbox-mode" className="flex flex-col space-y-1 cursor-pointer flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium leading-none text-white">
                {isSandboxActive ? 'Test Mode Active' : 'Production Mode Active'}
              </span>
            </div>
            <span className="text-sm text-white/70">
              {isSandboxActive
                ? 'Currently using Stripe test cards (4242 4242 4242 4242) - no real charges'
                : 'Currently using production environment - real payment processing'}
            </span>
            <span className="text-xs text-yellow-400/80 mt-1">
              {isSandboxActive
                ? '⚠️ Turning this OFF will switch to PRODUCTION (real payments)'
                : '⚠️ Turning this ON will switch to TEST mode (test cards only)'}
            </span>
          </Label>
          <Switch
            id="sandbox-mode"
            checked={isSandboxActive}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
            className="data-[state=checked]:bg-orange-500 data-[state=unchecked]:bg-green-600"
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

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent className="bg-black/90 border-white/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">
                {pendingSandboxMode ? 'Enable Test Mode?' : 'Enable Production Mode?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-white/70">
                {pendingSandboxMode ? (
                  <>
                    <strong className="text-yellow-400">⚠️ WARNING:</strong> This will enable <strong>TEST MODE</strong>.
                    <br /><br />
                    The app will use Stripe test cards (4242 4242 4242 4242) and the sandbox RevenueCat API key. No real payments will be processed.
                    <br /><br />
                    <strong>The page will automatically reload after this change.</strong>
                    <br /><br />
                    Are you sure you want to switch to test mode?
                  </>
                ) : (
                  <>
                    <strong className="text-red-400">🚨 CRITICAL WARNING:</strong> This will enable <strong>PRODUCTION MODE</strong>.
                    <br /><br />
                    The app will use the production RevenueCat API key and process REAL payments. Real credit cards will be charged.
                    <br /><br />
                    <strong>The page will automatically reload after this change.</strong>
                    <br /><br />
                    Are you absolutely sure you want to switch to production mode?
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmToggle}
                className={pendingSandboxMode ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  pendingSandboxMode ? 'Enable Test Mode' : 'Enable Production Mode'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

