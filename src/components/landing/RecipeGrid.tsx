import React from "react";
import { useInViewAnimation } from "@/hooks/useInViewAnimation";
import HoneydewBentoGrid from "./BentoGrid";

const RecipeGrid = () => {
  const [sectionRef, inView] = useInViewAnimation<HTMLElement>();
  
  return (
    <section ref={sectionRef} className="py-16">
      <div className="container mx-auto px-4">
        {/* Header and Subheader for Bento Section */}
        <div className={`text-center mb-12 transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Professional Tools in One Platform
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            From game predictions to trend analysis, model tracking to historical data - WagerProof brings all your betting analytics together seamlessly
          </p>
        </div>
        
        {/* Bento Grid */}
        <div className={`transition-all duration-700 delay-200 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <HoneydewBentoGrid />
        </div>
      </div>
    </section>
  );
};

export default RecipeGrid;7