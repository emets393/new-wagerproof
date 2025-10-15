import { useState } from 'react';
import { BarChart } from 'lucide-react';
import { AnalyticsFiltersMockup } from '../mockups/AnalyticsFiltersMockup';
import { Touchpoint } from '../Touchpoint';
import { FeatureDetailModal } from '../FeatureDetailModal';
import { analyticsTouchpoints, TouchpointData } from '@/data/learnMockData';

export function LearnNFLAnalytics() {
  const [selectedTouchpoint, setSelectedTouchpoint] = useState<TouchpointData | null>(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <BarChart className="h-8 w-8 text-primary dark:text-blue-400" />
        </div>
        <h2 className="text-4xl font-bold">Historical NFL Analytics</h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Discover betting patterns and trends with advanced filtering across thousands of historical games.
        </p>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 max-w-3xl mx-auto">
        <h3 className="text-xl font-semibold mb-3">Why Use This Feature?</h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">20+ Filter Options:</strong> Filter by weather, day of week, teams, betting lines,
              and last game conditions to find specific patterns
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Visual Analytics:</strong> Beautiful donut charts instantly show you win rates,
              cover rates, and over/under trends
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Large Sample Sizes:</strong> Based on 2,800+ games from 2018-2025 for
              statistically significant results
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Team Performance Tracking:</strong> See how individual teams perform
              in various situations throughout their history
            </span>
          </li>
        </ul>
      </div>

      {/* Interactive Mockup */}
      <div className="relative">
        <div className="mb-6 text-center">
          <h3 className="text-2xl font-semibold mb-2">Discover the Power of Data</h3>
          <p className="text-muted-foreground">
            Explore how to uncover profitable betting patterns using historical analytics
          </p>
        </div>

        <div className="relative inline-block w-full">
          <AnalyticsFiltersMockup />
          
          {/* Touchpoints */}
          {analyticsTouchpoints.map((touchpoint) => (
            <Touchpoint
              key={touchpoint.id}
              id={touchpoint.id}
              position={touchpoint.position}
              title={touchpoint.title}
              briefText={touchpoint.briefText}
              onClick={() => setSelectedTouchpoint(touchpoint)}
            />
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedTouchpoint && (
        <FeatureDetailModal
          isOpen={!!selectedTouchpoint}
          onClose={() => setSelectedTouchpoint(null)}
          title={selectedTouchpoint.title}
          steps={selectedTouchpoint.detailSteps}
        />
      )}
    </div>
  );
}

