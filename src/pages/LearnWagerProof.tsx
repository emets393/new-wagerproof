import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { ProgressOutline, SECTIONS } from '@/components/learn/ProgressOutline';
import { LearnCFBPredictions } from '@/components/learn/sections/LearnCFBPredictions';
import { LearnNFLPredictions } from '@/components/learn/sections/LearnNFLPredictions';
import { LearnNFLAnalytics } from '@/components/learn/sections/LearnNFLAnalytics';
import { LearnTeaserTool } from '@/components/learn/sections/LearnTeaserTool';
import { LearnWagerBot } from '@/components/learn/sections/LearnWagerBot';
import { LearnGameAnalysis } from '@/components/learn/sections/LearnGameAnalysis';
import { trackLearnPageViewed, trackLearnSectionClicked } from '@/lib/mixpanel';

export default function LearnWagerProof() {
  const [activeSection, setActiveSection] = useState<string>('cfb-predictions');
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Track page view on mount
  useEffect(() => {
    trackLearnPageViewed();
  }, []);

  // Scroll spy implementation
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section-id');
            if (sectionId) {
              setActiveSection(sectionId);
            }
          }
        });
      },
      {
        threshold: [0, 0.5],
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
      
      // Track section click
      const section = SECTIONS.find(s => s.id === sectionId);
      if (section) {
        trackLearnSectionClicked(section.title, sectionId);
      }
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


  return (
    <div className="h-screen bg-background overflow-hidden">

      <div className="container mx-auto px-4 py-8 h-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
          {/* Progress Outline Sidebar */}
          <div className="lg:col-span-1 h-full">
            <div className="h-full overflow-y-auto pr-4">
              <ProgressOutline
                sections={SECTIONS}
                activeSection={activeSection}
                onSectionClick={handleSectionClick}
                completedSections={[]}
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 h-full overflow-y-auto pl-4">
            <div className="space-y-8 pb-16">
            {/* Welcome Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12 space-y-6"
            >
              <div className="flex items-center justify-center gap-4 px-4">
                <div className="flex-shrink-0">
                  <GraduationCap className="h-16 w-16 text-primary dark:text-blue-400" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent dark:bg-gradient-to-r dark:from-white dark:to-white/80 dark:bg-clip-text dark:text-transparent whitespace-nowrap">
                  Learn WagerProof
                </h1>
              </div>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Master every feature of WagerProof with interactive tutorials and real examples.
                Click on any glowing point to learn more.
              </p>
              <div className="flex items-center justify-center gap-4 pt-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    {SECTIONS.length} Features to Explore
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Sections */}
            {sections.map((section) => (
              <motion.section
                key={section.id}
                ref={(el) => (sectionRefs.current[section.id] = el as HTMLDivElement)}
                data-section-id={section.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: false, margin: '-100px' }}
                transition={{ duration: 0.5 }}
                className="scroll-mt-24"
              >
                <div className="bg-card dark:bg-orange-950/20 backdrop-blur-sm rounded-2xl shadow-xl border border-border p-8 md:p-12">
                  {section.component}
                </div>
              </motion.section>
            ))}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

