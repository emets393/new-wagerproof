import { useSearchParams } from 'react-router-dom';
import { TrendsWorkbench } from '@/features/analysis/components/TrendsWorkbench';
import { isSport, type Sport } from '@/features/analysis/sportAdapters';

/**
 * Unified chat-forward Historical Trends page. URL drives the active sport + bet type
 * (`/historical-trends?sport=nfl|cfb|mlb&bet=<betType>`); filter values are held in the workbench
 * (too large to encode in the URL). Replaces the three per-sport analytics pages.
 */
export default function HistoricalTrends() {
  const [params, setParams] = useSearchParams();
  const sport: Sport = isSport(params.get('sport')) ? (params.get('sport') as Sport) : 'nfl';
  const betType = params.get('bet') || undefined;

  const setUrl = (nextSport: Sport, nextBet: string) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('sport', nextSport);
        if (nextBet) p.set('bet', nextBet);
        return p;
      },
      { replace: true },
    );
  };

  return <TrendsWorkbench sport={sport} betType={betType} setUrl={setUrl} />;
}
