import { useState } from 'react';
import { Target } from 'lucide-react';
import { GameAnalysisMockup } from '../mockups/GameAnalysisMockup';
import { Touchpoint } from '../Touchpoint';
import { FeatureDetailModal } from '../FeatureDetailModal';
import { gameAnalysisTouchpoints, TouchpointData } from '@/data/learnMockData';

export function LearnGameAnalysis() {
  const [selectedTouchpoint, setSelectedTouchpoint] = useState<TouchpointData | null>(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Target className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-4xl font-bold">Game Analysis Deep Dive</h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Get comprehensive breakdowns showing how multiple models reach consensus predictions.
        </p>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 max-w-3xl mx-auto">
        <h3 className="text-xl font-semibold mb-3">Why Use This Feature?</h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Multi-Model Consensus:</strong> See predictions from multiple models combined
              using weighted averages for maximum accuracy
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Model Transparency:</strong> View exactly which features each model uses
              and their historical sample sizes
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Confidence Visualization:</strong> Beautiful circular charts show exact
              win probabilities for easy interpretation
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Model Agreement Scoring:</strong> Know when models strongly agree (high
              confidence) vs. disagree (proceed with caution)
            </span>
          </li>
        </ul>
      </div>

      {/* Interactive Mockup */}
      <div className="relative">
        <div className="mb-6 text-center">
          <h3 className="text-2xl font-semibold mb-2">Detailed Game Breakdown</h3>
          <p className="text-muted-foreground">
            Explore how we combine multiple models to create the most accurate predictions
          </p>
        </div>

        <div className="relative inline-block w-full">
          <GameAnalysisMockup />
          
          {/* Touchpoints */}
          {gameAnalysisTouchpoints.map((touchpoint) => (
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

      {/* Pro Tips */}
      <div className="bg-muted/50 rounded-lg p-6 max-w-3xl mx-auto">
        <h3 className="text-lg font-semibold mb-4">Pro Tips for Game Analysis:</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">1.</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Look for High Agreement:</strong> When consensus confidence is 70%+,
              models strongly agree on the outcome
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">2.</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Check Sample Sizes:</strong> Models with 40+ games have more reliable
              historical data
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">3.</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Feature Count Matters:</strong> Models using 10+ features provide more
              comprehensive analysis
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold">4.</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Skip Low Confidence:</strong> When models disagree significantly (confidence
              below 55%), consider passing on the bet
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

