import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSaleMode } from '@/hooks/useSaleMode';
import { Loader2, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SaleModeToggle() {
  const { isSaleActive, discountPercentage, loading, updateSaleMode, isUpdating } = useSaleMode();
  const { toast } = useToast();

  const handleToggle = async (enabled: boolean) => {
    try {
      updateSaleMode({ enabled, discountPercentage: 50 });
      
      toast({
        title: enabled ? 'Sale Mode Enabled' : 'Sale Mode Disabled',
        description: enabled 
          ? 'Paywall now shows discounted prices (50% off)'
          : 'Paywall now shows regular prices',
      });
    } catch (error: any) {
      toast({
        title: 'Error updating sale mode',
        description: error.message || 'Failed to update sale mode',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Tag className="h-5 w-5" />
            Sale Mode
          </CardTitle>
          <CardDescription className="text-white/70">Control promotional pricing across the platform</CardDescription>
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
          <Tag className="h-5 w-5" />
          Sale Mode
        </CardTitle>
        <CardDescription className="text-white/70">Control promotional pricing across the platform</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between space-x-4">
          <Label htmlFor="sale-mode" className="flex flex-col space-y-1 cursor-pointer">
            <span className="text-sm font-medium leading-none">
              Enable Sale Mode
            </span>
            <span className="text-sm text-muted-foreground">
              Show discounted prices on paywall ({discountPercentage}% off)
            </span>
          </Label>
          <Switch
            id="sale-mode"
            checked={isSaleActive}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
          />
        </div>

        {isUpdating && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating...
          </div>
        )}

        <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-4 space-y-2">
          <h4 className="text-sm font-semibold text-white">Pricing Details:</h4>
          <div className="text-sm space-y-1 text-white/90">
            <div className="flex justify-between">
              <span>Monthly Plan:</span>
              <span className="font-medium">
                {isSaleActive ? (
                  <>
                    <span className="line-through text-white/50 mr-2">$40</span>
                    <span className="text-green-400">$20</span>
                  </>
                ) : (
                  <span>$40</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Yearly Plan:</span>
              <span className="font-medium">
                {isSaleActive ? (
                  <>
                    <span className="line-through text-white/50 mr-2">$199</span>
                    <span className="text-green-400">$99</span>
                  </>
                ) : (
                  <span>$199</span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/60 space-y-1">
          <p>• Sale mode uses discount product codes in RevenueCat</p>
          <p>• Regular: <code className="text-xs bg-white/10 px-1 rounded">wagerproof_monthly_pro</code>, <code className="text-xs bg-white/10 px-1 rounded">wagerproof_pro_yearly</code></p>
          <p>• Discounted: <code className="text-xs bg-white/10 px-1 rounded">wagerproof_monthly_pro_discount</code>, <code className="text-xs bg-white/10 px-1 rounded">wagerproof_yearly_pro_discount</code></p>
        </div>
      </CardContent>
    </Card>
  );
}

