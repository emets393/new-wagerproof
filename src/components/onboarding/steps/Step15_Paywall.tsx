import PaywallComponent from '@/components/Paywall';
import type { PaywallHandle } from '@/components/Paywall';
import { forwardRef } from 'react';

export const Paywall = forwardRef<PaywallHandle>((props, ref) => {
  return <PaywallComponent ref={ref} showButton={false} {...props} />;
});

Paywall.displayName = 'Paywall';
