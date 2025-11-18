
import React from "react";
import { useInViewAnimation } from "@/hooks/useInViewAnimation";
import TrueFocus from "./TrueFocus";
import CurvedLoop from "@/components/magicui/curved-loop";

const importOptions = [
  "NFL Games",
  "College Football",
  "Live Odds",
  "Historical Data",
  "Weather Stats",
  "Team Analytics",
  "NBA",
  "NCAAB",
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
      className={`py-8 md:py-14 bg-transparent transition-opacity duration-700 ${inViewSection ? "opacity-100 animate-fade-in" : "opacity-0"}`}
    >
      <div className={`relative flex w-full flex-col items-center justify-center transition-all duration-700 ${inViewSection ? "animate-scale-in" : "scale-95 opacity-0"}`}>
        {/* TrueFocus Text */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 my-4 md:my-8 py-4 md:py-8 lg:px-[65px]">
          <div className="text-center max-w-5xl mx-auto transition-all duration-700">
            <div className="flex justify-center items-center mb-4 md:mb-8">
              <TrueFocus
                customWords={["Find", "Alpha", "Instead", "Of Noise"]}
                manualMode={false}
                blurAmount={5}
                borderColor="#39ff14"
                glowColor="rgba(57, 255, 20, 0.6)"
                animationDuration={0.5}
                pauseBetweenAnimations={0.8}
              />
            </div>
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
            className="text-honeydew-600 dark:text-honeydew-400 w-full"
          />
        </div>
      </div>
    </section>
  );
};

export default RecipeImport;
