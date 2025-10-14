import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressOutline, SECTIONS } from '@/components/learn/ProgressOutline';
import { LearnCFBPredictions } from '@/components/learn/sections/LearnCFBPredictions';
import { LearnNFLPredictions } from '@/components/learn/sections/LearnNFLPredictions';
import { LearnNFLAnalytics } from '@/components/learn/sections/LearnNFLAnalytics';
import { LearnTeaserTool } from '@/components/learn/sections/LearnTeaserTool';
import { LearnWagerBot } from '@/components/learn/sections/LearnWagerBot';
import { LearnGameAnalysis } from '@/components/learn/sections/LearnGameAnalysis';

export default function LearnWagerProof() {
  const [activeSection, setActiveSection] = useState<string>('cfb-predictions');
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scroll spy implementation
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section-id');
            if (sectionId) {
              setActiveSection(sectionId);
              
              // Mark section as completed when user scrolls past 80% of it
              if (entry.intersectionRatio > 0.8) {
                setCompletedSections((prev) => {
                  if (!prev.includes(sectionId)) {
                    return [...prev, sectionId];
                  }
                  return prev;
                });
              }
            }
          }
        });
      },
      {
        threshold: [0, 0.5, 0.8, 1],
        rootMargin: '-20% 0px -20% 0px',
      }
    );

    // Observe all sections
    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) {
        observerRef.current?.observe(ref);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  const handleSectionClick = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNext = () => {
    const currentIndex = SECTIONS.findIndex((s) => s.id === activeSection);
    if (currentIndex < SECTIONS.length - 1) {
      const nextSection = SECTIONS[currentIndex + 1];
      handleSectionClick(nextSection.id);
    }
  };

  const handlePrevious = () => {
    const currentIndex = SECTIONS.findIndex((s) => s.id === activeSection);
    if (currentIndex > 0) {
      const previousSection = SECTIONS[currentIndex - 1];
      handleSectionClick(previousSection.id);
    }
  };

  const sections = [
    { id: 'cfb-predictions', component: <LearnCFBPredictions /> },
    { id: 'nfl-predictions', component: <LearnNFLPredictions /> },
    { id: 'nfl-analytics', component: <LearnNFLAnalytics /> },
    { id: 'teaser-tool', component: <LearnTeaserTool /> },
    { id: 'wagerbot', component: <LearnWagerBot /> },
    { id: 'game-analysis', component: <LearnGameAnalysis /> },
  ];

  const currentIndex = SECTIONS.findIndex((s) => s.id === activeSection);
  const progressPercentage = ((currentIndex + 1) / SECTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Progress Outline Sidebar */}
          <div className="lg:col-span-1">
            <ProgressOutline
              sections={SECTIONS}
              activeSection={activeSection}
              onSectionClick={handleSectionClick}
              completedSections={completedSections}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-16">
            {/* Welcome Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12 space-y-4"
            >
              <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Learn WagerProof
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Master every feature of WagerProof with interactive tutorials and real examples.
                Click on any glowing point to learn more.
              </p>
              <div className="flex items-center justify-center gap-4 pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    {SECTIONS.length} Features to Explore
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-muted-foreground">
                    {completedSections.length} Completed
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Sections */}
            {sections.map((section) => (
              <motion.section
                key={section.id}
                ref={(el) => (sectionRefs.current[section.id] = el)}
                data-section-id={section.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: false, margin: '-100px' }}
                transition={{ duration: 0.5 }}
                className="scroll-mt-24"
              >
                <div className="bg-background/80 backdrop-blur-sm rounded-2xl shadow-xl border border-border p-8 md:p-12">
                  {section.component}
                </div>
              </motion.section>
            ))}

            {/* Navigation Buttons */}
            <div className="sticky bottom-8 flex items-center justify-between bg-background/95 backdrop-blur-sm border border-border rounded-full p-4 shadow-2xl">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              <div className="hidden md:flex items-center gap-2 text-sm font-medium">
                <span className="text-muted-foreground">Section {currentIndex + 1} of {SECTIONS.length}:</span>
                <span className="text-foreground">
                  {SECTIONS[currentIndex]?.title}
                </span>
              </div>

              {currentIndex < SECTIONS.length - 1 ? (
                <Button
                  onClick={handleNext}
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="flex items-center gap-2"
                  variant="default"
                >
                  Back to Top
                </Button>
              )}
            </div>

            {/* Completion Message */}
            {completedSections.length === SECTIONS.length && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-2 border-green-500 rounded-2xl p-8 text-center space-y-4"
              >
                <div className="text-6xl">🎉</div>
                <h2 className="text-3xl font-bold text-green-900 dark:text-green-100">
                  Congratulations!
                </h2>
                <p className="text-lg text-green-800 dark:text-green-200">
                  You've completed the WagerProof tutorial. You're now ready to make smarter bets!
                </p>
                <Button
                  onClick={() => window.location.href = '/college-football'}
                  size="lg"
                  className="mt-4"
                >
                  Start Using WagerProof
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

