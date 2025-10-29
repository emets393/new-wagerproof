import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PolymarketTest() {
  const [step1Response, setStep1Response] = useState<any>(null);
  const [step2Data, setStep2Data] = useState<any>(null);
  const [step3Response, setStep3Response] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setStep1Response(null);
    setStep2Data(null);
    setStep3Response(null);

    try {
      // STEP 1: Search Gamma API
      console.log('🔍 STEP 1: Searching Gamma API for NFL game...');
      
      const searchQueries = ['Ravens Dolphins', 'Chiefs Bills', 'Cowboys Eagles', 'Lions Packers'];
      let markets: any[] = [];
      let successfulQuery = '';

      for (const query of searchQueries) {
        const url = `https://gamma-api.polymarket.com/markets?limit=50&closed=false&_search=${encodeURIComponent(query)}`;
        console.log(`Trying: ${query}`);
        console.log(`URL: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
          console.log(`Failed with ${response.status}`);
          continue;
        }

        const data = await response.json();
        if (data && Array.isArray(data) && data.length > 0) {
          // Look for actual NFL matches
          const nflMarkets = data.filter((m: any) => {
            const question = (m.question || '' + m.title || '').toLowerCase();
            return query.split(' ').some(team => question.includes(team.toLowerCase()));
          });

          if (nflMarkets.length > 0) {
            markets = nflMarkets;
            successfulQuery = query;
            console.log(`✅ Found ${markets.length} markets with "${query}"`);
            break;
          }
        }
      }

      if (markets.length === 0) {
        setError('No NFL markets found');
        setLoading(false);
        return;
      }

      const market = markets[0];
      setStep1Response({
        query: successfulQuery,
        totalMarkets: markets.length,
        selectedMarket: {
          question: market.question,
          title: market.title,
          closed: market.closed,
          active: market.active,
          endDate: market.endDate,
          tokens: market.tokens,
          clobTokenIds: market.clobTokenIds,
          outcomes: market.outcomes,
          volume: market.volume,
          liquidity: market.liquidity,
        },
        fullMarket: market,
      });

      console.log('📦 Market data:', market);

      // STEP 2: Extract token ID
      console.log('🎯 STEP 2: Extracting token ID...');
      
      let tokenId: string | null = null;
      let teamName: string | null = null;
      let extractionMethod = '';

      if (market.tokens && market.tokens.length > 0) {
        const token = market.tokens[0];
        tokenId = token.token_id || token.tokenId;
        teamName = token.outcome;
        extractionMethod = 'tokens array';
        console.log(`✅ Token ID from tokens: ${tokenId}`);
      } else if (market.clobTokenIds && market.clobTokenIds.length > 0) {
        tokenId = market.clobTokenIds[0];
        extractionMethod = 'clobTokenIds';
        console.log(`✅ Token ID from clobTokenIds: ${tokenId}`);
      }

      if (!tokenId) {
        setError('Could not extract token ID');
        setLoading(false);
        return;
      }

      setStep2Data({
        tokenId,
        teamName,
        extractionMethod,
        fullToken: market.tokens?.[0] || null,
      });

      // STEP 3: Fetch price history
      console.log('📈 STEP 3: Fetching price history...');
      
      const priceUrl = `https://clob.polymarket.com/prices-history?market=${tokenId}&interval=max&fidelity=60`;
      console.log(`URL: ${priceUrl}`);

      const priceResponse = await fetch(priceUrl);
      if (!priceResponse.ok) {
        throw new Error(`Price history failed: ${priceResponse.status}`);
      }

      const priceData = await priceResponse.json();
      console.log('✅ Got price history:', priceData);

      const history = priceData.history || [];
      const latest = history[history.length - 1];

      setStep3Response({
        totalPoints: history.length,
        firstPoint: history[0],
        lastPoint: latest,
        sample: history.slice(0, 5),
        fullResponse: priceData,
        summary: {
          marketQuestion: market.question || market.title,
          tokenRepresents: teamName,
          currentProbability: latest ? `${(latest.p * 100).toFixed(2)}%` : 'N/A',
          opponentProbability: latest ? `${((1 - latest.p) * 100).toFixed(2)}%` : 'N/A',
          timeRange: history.length > 0 ? {
            start: new Date(history[0].t * 1000).toISOString(),
            end: new Date(latest.t * 1000).toISOString(),
          } : null,
        },
      });

      console.log('✅ TEST COMPLETE!');
      
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Polymarket API Test - Full Flow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button onClick={runTest} disabled={loading} size="lg">
            {loading ? 'Testing...' : 'Run API Test'}
          </Button>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Step 1 Response */}
          {step1Response && (
            <div className="space-y-2">
              <h3 className="text-xl font-bold">📍 Step 1: Gamma API Search Response</h3>
              <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs">{JSON.stringify(step1Response, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Step 2 Data */}
          {step2Data && (
            <div className="space-y-2">
              <h3 className="text-xl font-bold">📍 Step 2: Token Extraction</h3>
              <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs">{JSON.stringify(step2Data, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Step 3 Response */}
          {step3Response && (
            <div className="space-y-2">
              <h3 className="text-xl font-bold">📍 Step 3: Price History Response</h3>
              <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs">{JSON.stringify(step3Response, null, 2)}</pre>
              </div>
              
              <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <h4 className="font-bold mb-2">📊 Summary</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Market:</strong> {step3Response.summary.marketQuestion}</p>
                  <p><strong>Token represents:</strong> {step3Response.summary.tokenRepresents}</p>
                  <p><strong>Current odds:</strong> {step3Response.summary.currentProbability} vs {step3Response.summary.opponentProbability}</p>
                  <p><strong>Data points:</strong> {step3Response.totalPoints}</p>
                  {step3Response.summary.timeRange && (
                    <p><strong>Time range:</strong> {step3Response.summary.timeRange.start} to {step3Response.summary.timeRange.end}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

