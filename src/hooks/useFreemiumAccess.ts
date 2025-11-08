import { useAccessControl } from './useAccessControl';

export function useFreemiumAccess() {
  const { hasAccess } = useAccessControl();
  const hasBypassedPaywall = typeof window !== 'undefined' 
    ? localStorage.getItem('wagerproof_paywall_bypassed') === 'true'
    : false;
  
  return {
    isFreemiumUser: !hasAccess && hasBypassedPaywall,
    isPaidUser: hasAccess,
    isBlockedUser: !hasAccess && !hasBypassedPaywall,
  };
}

