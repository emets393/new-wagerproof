import { useState } from 'react';
import { Shield } from 'lucide-react';
import { NFLGameCardMockup } from '../mockups/NFLGameCardMockup';
import { Touchpoint } from '../Touchpoint';
import { FeatureDetailModal } from '../FeatureDetailModal';
import { nflTouchpoints, TouchpointData } from '@/data/learnMockData';

export function LearnNFLPredictions() {
  const [selectedTouchpoint, setSelectedTouchpoint] = useState<TouchpointData | null>(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Shield className="h-8 w-8 text-primary dark:text-blue-400" />
        </div>
        <h2 className="text-4xl font-bold">NFL Predictions</h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Advanced NFL predictions powered by Expected Points Added (EPA) models,
          delivering the most accurate football analytics available.
        </p>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 max-w-3xl mx-auto">
        <h3 className="text-xl font-semibold mb-3">Why Use This Feature?</h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">EPA Model:</strong> Uses Expected Points Added, the most predictive stat
              in football, to generate accurate predictions
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Confidence Scoring:</strong> Every prediction includes a confidence percentage
              so you know how strong the signal is
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Historical Data Access:</strong> One-click access to head-to-head history
              and line movement data
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Weather & Indoor Games:</strong> Automatically factors in venue conditions
              for accurate predictions
            </span>
          </li>
        </ul>
      </div>

      {/* Interactive Mockup */}
      <div className="relative">
        <div className="mb-6 text-center">
          <h3 className="text-2xl font-semibold mb-2">Explore the Interface</h3>
          <p className="text-muted-foreground">
            Click on the glowing points to learn how to use NFL predictions effectively
          </p>
        </div>

        <div className="relative inline-block w-full">
          <NFLGameCardMockup />
          
          {/* Touchpoints */}
          {nflTouchpoints.map((touchpoint) => (
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

