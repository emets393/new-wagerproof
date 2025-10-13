
import React from "react";
import { useInViewAnimation } from "@/hooks/useInViewAnimation";
import RotatingText from "./RotatingText";
import CurvedLoop from "@/components/magicui/curved-loop";

const importOptions = [
  "NFL Games",
  "College Football",
  "Live Odds",
  "Historical Data",
  "Weather Stats",
  "Team Analytics",
  "Player Props",
  "Betting Trends",
  "Market Lines",
  "Real-Time Updates"
];

// Create text scroller content from import options
const importText = importOptions.join(" ✦ ") + " ✦ ";




const RecipeImport = () => {
  const [sectionRef, inViewSection] = useInViewAnimation<HTMLElement>();
  
  return (
    <section
      id="recipes"
      ref={sectionRef}
      className={`py-14 bg-transparent transition-opacity duration-700 ${inViewSection ? "opacity-100 animate-fade-in" : "opacity-0"}`}
    >
      <div className={`relative flex w-full flex-col items-center justify-center transition-all duration-700 ${inViewSection ? "animate-scale-in" : "scale-95 opacity-0"}`}>
        {/* Header and subheader */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 my-8 py-8 lg:px-[65px]">
          <div className="text-center max-w-4xl mx-auto transition-all duration-700">
            <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-4">
              {/* Header and Rotating Text */}
              <div className="flex flex-col md:flex-row justify-center items-center gap-3">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
                  Track Every
                </h2>
                <div className="relative min-w-[240px] flex justify-center items-center">
                  <RotatingText
                    texts={[
                      "Game",
                      "Stat",
                      "Line",
                      "Trend",
                      "Matchup",
                      "Odds",
                      "Model",
                      "Edge",
                      "Play",
                      "Bet",
                      "Outcome",
                    ]}
                    mainClassName="inline-flex items-center justify-center px-3 py-1 md:py-2 bg-honeydew-200 text-honeydew-900 overflow-hidden rounded-lg text-3xl md:text-4xl font-bold"
                    staggerFrom={"last"}
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "-120%" }}
                    staggerDuration={0.02}
                    splitLevelClassName="overflow-hidden pb-0.5"
                    animatePresenceMode="popLayout"
                    transition={{ type: "spring", damping: 32, stiffness: 420, layout: { duration: 0.35, ease: "easeInOut" } }}
                    rotationInterval={1000}
                   
                  />
                </div>
              </div>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
              
            </p>
          </div>
        </div>

        {/* Text Scroller - Full Screen Width */}
        <div 
          className="h-16 flex items-center justify-center"
          style={{ 
            width: '100vw',
            marginLeft: 'calc(-50vw + 50%)'
          }}
        >
          <CurvedLoop
            marqueeText={importText}
            speed={0.8}
            curveAmount={-150}
            interactive={true}
            direction="left"
            className="fill-honeydew-600 dark:fill-honeydew-400 w-full"
          />
        </div>
      </div>
    </section>
  );
};

export default RecipeImport;
