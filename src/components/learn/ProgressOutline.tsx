import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Trophy, 
  Shield, 
  BarChart, 
  ScatterChart, 
  Bot, 
  Target 
} from 'lucide-react';

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
}

interface ProgressOutlineProps {
  sections: Section[];
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
  completedSections: string[];
}

export function ProgressOutline({ 
  sections, 
  activeSection, 
  onSectionClick,
  completedSections 
}: ProgressOutlineProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const progressPercentage = (completedSections.length / sections.length) * 100;

  if (isMobile) {
    return (
      <div className="sticky top-0 z-30 bg-background border-b shadow-sm">
        <div className="p-4">
          <Button
            variant="outline"
            className="w-full flex items-center justify-between"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <span className="font-semibold">Learn Progress ({Math.round(progressPercentage)}%)</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
          </Button>

          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 space-y-2"
            >
              {sections.map((section) => {
                const isActive = section.id === activeSection;
                const isCompleted = completedSections.includes(section.id);
                
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      onSectionClick(section.id);
                      setIsCollapsed(true);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <Check className="h-5 w-5 text-primary" />
                      ) : (
                        section.icon
                      )}
                    </div>
                    <span className="text-sm font-medium text-left">{section.title}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </div>

      </div>
    );
  }

  return (
    <Card className="sticky top-6 p-6 space-y-6 shadow-lg bg-orange-50 dark:bg-orange-950/20 border-border">
      <div className="pb-4">
        <h3 className="font-bold text-lg">Learn WagerProof</h3>
      </div>


      {/* Section Navigation */}
      <nav className="space-y-2">
        {sections.map((section) => {
          const isActive = section.id === activeSection;
          const isCompleted = completedSections.includes(section.id);
          
          return (
            <button
              key={section.id}
              onClick={() => onSectionClick(section.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-md'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <div className="relative">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                ) : (
                  <div className={isActive ? 'text-white' : 'text-muted-foreground'}>
                    {section.icon}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-left flex-1">
                {section.title}
              </span>
              {isActive && (
                <motion.div
                  className="w-2 h-2 rounded-full bg-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Completion Message */}
      {progressPercentage === 100 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center"
        >
          <Check className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="font-semibold text-sm text-foreground">
            Tutorial Complete!
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            You're ready to use WagerProof
          </p>
        </motion.div>
      )}
    </Card>
  );
}

export const SECTIONS: Section[] = [
  {
    id: 'cfb-predictions',
    title: 'College Football',
    icon: <Trophy className="h-5 w-5" />
  },
  {
    id: 'nfl-predictions',
    title: 'NFL Predictions',
    icon: <Shield className="h-5 w-5" />
  },
  {
    id: 'nfl-analytics',
    title: 'Historical Analytics',
    icon: <BarChart className="h-5 w-5" />
  },
  {
    id: 'teaser-tool',
    title: 'Teaser Sharpness',
    icon: <ScatterChart className="h-5 w-5" />
  },
  {
    id: 'wagerbot',
    title: 'WagerBot AI',
    icon: <Bot className="h-5 w-5" />
  },
  {
    id: 'game-analysis',
    title: 'Game Analysis',
    icon: <Target className="h-5 w-5" />
  }
];

