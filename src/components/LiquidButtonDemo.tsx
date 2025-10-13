import { PlusIcon, RefreshCw } from 'lucide-react';
import {
  LiquidButton,
  type LiquidButtonProps,
} from '@/components/animate-ui/components/buttons/liquid';

interface LiquidButtonDemoProps {
  variant?: LiquidButtonProps['variant'];
  size?: LiquidButtonProps['size'];
}

export default function LiquidButtonDemo({
  variant = 'default',
  size = 'default',
}: LiquidButtonDemoProps) {
  return (
    <div className="flex flex-wrap gap-4 p-8">
      <LiquidButton variant="default" size="default">
        Default Button
      </LiquidButton>
      
      <LiquidButton variant="outline" size="default">
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </LiquidButton>
      
      <LiquidButton variant="secondary" size="sm">
        Small Button
      </LiquidButton>
      
      <LiquidButton variant="destructive" size="lg">
        Large Button
      </LiquidButton>
      
      <LiquidButton variant="ghost" size="icon">
        <PlusIcon />
      </LiquidButton>
      
      <LiquidButton variant={variant} size={size}>
        {size === 'icon' ? <PlusIcon /> : 'Hover me'}
      </LiquidButton>
    </div>
  );
}


