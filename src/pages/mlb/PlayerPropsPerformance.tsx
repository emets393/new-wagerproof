import { Navigate } from 'react-router-dom';

/** @deprecated Redirects to the unified report hub Performance tab. */
export default function PlayerPropsPerformance() {
  return <Navigate to="/mlb/picks-report?tab=performance" replace />;
}
