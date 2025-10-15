import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { CFBGameCardMockup } from '../mockups/CFBGameCardMockup';
import { Touchpoint } from '../Touchpoint';
import { FeatureDetailModal } from '../FeatureDetailModal';
import { cfbTouchpoints, TouchpointData } from '@/data/learnMockData';

export function LearnCFBPredictions() {
  const [selectedTouchpoint, setSelectedTouchpoint] = useState<TouchpointData | null>(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Trophy className="h-8 w-8 text-primary dark:text-blue-400" />
        </div>
        <h2 className="text-4xl font-bold">College Football Predictions</h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Get AI-powered predictions for every college football game with detailed analytics,
          weather conditions, and public betting insights.
        </p>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 max-w-3xl mx-auto">
        <h3 className="text-xl font-semibold mb-3">Why Use This Feature?</h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">AI Model Predictions:</strong> Our advanced algorithms analyze hundreds of factors
              to predict spreads, totals, and moneylines with high accuracy
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Weather Integration:</strong> Real-time weather data helps you understand
              how conditions will impact the game
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Public vs Sharp Money:</strong> See where the smart money is going and
              identify value opportunities
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Score Predictions:</strong> View projected final scores to help with
              over/under decisions
            </span>
          </li>
        </ul>
      </div>

      {/* Interactive Mockup */}
      <div className="relative">
        <div className="mb-6 text-center">
          <h3 className="text-2xl font-semibold mb-2">Try It Yourself</h3>
          <p className="text-muted-foreground">
            Hover over the glowing points to learn about each feature, or click for detailed explanations
          </p>
        </div>

        <div className="relative inline-block w-full">
          <CFBGameCardMockup />
          
          {/* Touchpoints */}
          {cfbTouchpoints.map((touchpoint) => (
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

