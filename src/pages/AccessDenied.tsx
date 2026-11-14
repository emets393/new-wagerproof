import { Navigate, useLocation } from 'react-router-dom';
import { PAYWALL_ROUTE } from '@/lib/routes';

/** Keep saved upgrade links working without loading the retired paywall. */
export default function AccessDenied() {
  const { search, hash } = useLocation();
  return <Navigate to={`${PAYWALL_ROUTE}${search}${hash}`} replace />;
}
