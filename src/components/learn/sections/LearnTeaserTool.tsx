import { useState } from 'react';
import { ScatterChart } from 'lucide-react';
import { TeaserChartMockup } from '../mockups/TeaserChartMockup';
import { Touchpoint } from '../Touchpoint';
import { FeatureDetailModal } from '../FeatureDetailModal';
import { teaserTouchpoints, TouchpointData } from '@/data/learnMockData';

export function LearnTeaserTool() {
  const [selectedTouchpoint, setSelectedTouchpoint] = useState<TouchpointData | null>(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <ScatterChart className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-4xl font-bold">NFL Teaser Sharpness Tool</h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Identify the best teams to include in your teasers using bias and sharpness analysis.
        </p>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 max-w-3xl mx-auto">
        <h3 className="text-xl font-semibold mb-3">Why Use This Feature?</h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Scientific Teaser Selection:</strong> Uses sharpness (prediction accuracy) and
              bias (consistent over/under performance) to identify ideal teaser candidates
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Visual Green Zone:</strong> Instantly see which teams have the most predictable
              outcomes - perfect for teasers
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Both Spread & O/U:</strong> Toggle between spread and over/under analysis
              to build the best possible teasers
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Matchup Filtering:</strong> Focus on specific upcoming games to build
              your weekly teaser strategy
            </span>
          </li>
        </ul>
      </div>

      {/* Interactive Mockup */}
      <div className="relative">
        <div className="mb-6 text-center">
          <h3 className="text-2xl font-semibold mb-2">Master Teaser Strategy</h3>
          <p className="text-muted-foreground">
            Learn how to read the sharpness chart and identify winning teaser opportunities
          </p>
        </div>

        <div className="relative inline-block w-full">
          <TeaserChartMockup />
          
          {/* Touchpoints */}
          {teaserTouchpoints.map((touchpoint) => (
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

