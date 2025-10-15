import { useState } from 'react';
import { Bot } from 'lucide-react';
import { WagerBotMockup } from '../mockups/WagerBotMockup';
import { Touchpoint } from '../Touchpoint';
import { FeatureDetailModal } from '../FeatureDetailModal';
import { wagerbotTouchpoints, TouchpointData } from '@/data/learnMockData';

export function LearnWagerBot() {
  const [selectedTouchpoint, setSelectedTouchpoint] = useState<TouchpointData | null>(null);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-4xl font-bold">WagerBot AI Assistant</h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Your personal AI betting assistant with access to all game data, predictions, and analytics.
        </p>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 max-w-3xl mx-auto">
        <h3 className="text-xl font-semibold mb-3">Why Use This Feature?</h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Context-Aware Intelligence:</strong> WagerBot automatically knows about all
              the games on your current page and can answer specific questions
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Natural Language Queries:</strong> Ask questions in plain English like
              "What's your best pick today?" or "Why do you favor the over?"
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Always Available:</strong> Access WagerBot from any page using the floating
              chat button - drag it anywhere on screen
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">✓</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">Educational & Strategic:</strong> Ask about betting concepts, strategies,
              and how to interpret data
            </span>
          </li>
        </ul>
      </div>

      {/* Interactive Mockup */}
      <div className="relative">
        <div className="mb-6 text-center">
          <h3 className="text-2xl font-semibold mb-2">Chat with AI</h3>
          <p className="text-muted-foreground">
            See how WagerBot provides intelligent, context-aware responses about games
          </p>
        </div>

        <div className="relative inline-block w-full">
          <WagerBotMockup />
          
          {/* Touchpoints */}
          {wagerbotTouchpoints.map((touchpoint) => (
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

      {/* Example Questions */}
      <div className="bg-muted/50 rounded-lg p-6 max-w-3xl mx-auto">
        <h3 className="text-lg font-semibold mb-4">Example Questions to Ask WagerBot:</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-background rounded p-3 text-sm">
            "What's your best pick for today?"
          </div>
          <div className="bg-background rounded p-3 text-sm">
            "Why do you favor the over in this game?"
          </div>
          <div className="bg-background rounded p-3 text-sm">
            "Compare the Chiefs and Bills predictions"
          </div>
          <div className="bg-background rounded p-3 text-sm">
            "Which games have the highest confidence?"
          </div>
          <div className="bg-background rounded p-3 text-sm">
            "Explain what EPA means"
          </div>
          <div className="bg-background rounded p-3 text-sm">
            "Should I tease this game?"
          </div>
        </div>
      </div>
    </div>
  );
}

