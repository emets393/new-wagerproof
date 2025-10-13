
import React, { useState } from "react";
import { BarChart3, TrendingUp, Target, Trophy } from "lucide-react";
import { useInViewAnimation } from "@/hooks/useInViewAnimation";
import ShineBorder from "@/components/magicui/shine-border";
import GlassIcon from "@/components/magicui/glass-icon";

const steps = [
  {
    title: "Analyze Data",
    description: "Access real-time stats, trends, and matchup analysis powered by professional models",
    icon: <BarChart3 />,
    iconColor: "pink",
    borderColor: ["#ec4899", "#f472b6", "#ec4899"],
  },
  {
    title: "Find Edges",
    description: "Identify betting opportunities where models disagree with market lines",
    icon: <TrendingUp />,
    iconColor: "blue",
    borderColor: ["#3b82f6", "#60a5fa", "#3b82f6"],
  },
  {
    title: "Make Picks",
    description: "Get confident predictions with probability breakdowns and risk assessment",
    icon: <Target />,
    iconColor: "purple",
    borderColor: ["#a855f7", "#c084fc", "#a855f7"],
  },
  {
    title: "Tune the Model",
    description: "Customize your own betting model based on your risk preference and strategy",
    icon: <Trophy />,
    iconColor: "green",
    borderColor: ["#22c55e", "#4ade80", "#22c55e"],
  },
];

const UserJourney = () => {
  const [sectionRef, inView] = useInViewAnimation<HTMLElement>();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section
      ref={sectionRef}
      id="user-journey"
      className="py-14 bg-transparent"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-3xl mx-auto mb-12 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            From Data to Decisions in Seconds
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Your seamless journey from raw stats to winning bets
          </p>
        </div>

        <div className="relative">
          {/* Connecting line with gradient and curve */}
          <svg
            className="absolute top-1/2 left-0 w-full h-4 -translate-y-1/2 hidden lg:block"
            preserveAspectRatio="none"
            viewBox="0 0 1000 20"
          >
            <path
              d="M0,10 C250,30 750,-10 1000,10"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="2"
              className={`transition-all duration-1000 ${
                inView ? "opacity-100" : "opacity-0"
              }`}
            />
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="33%" stopColor="#8b5cf6" />
                <stop offset="66%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
          </svg>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, idx) => (
              <div
                key={step.title}
                className={`transition-all duration-700 delay-${idx * 100} ${
                  inView
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-10"
                }`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <ShineBorder
                  className="h-full w-full bg-white dark:bg-gray-800 hover:shadow-xl transition-all hover:-translate-y-1 duration-300"
                  borderRadius={16}
                  borderWidth={1}
                  duration={14}
                  color={step.borderColor}
                >
                  <div className="flex flex-col h-full p-3">
                    <div className="mb-4">
                      <GlassIcon
                        icon={step.icon}
                        color={step.iconColor}
                        label={step.title}
                        size="md"
                        isHovered={hoveredIndex === idx}
                      />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 flex-grow">
                      {step.description}
                    </p>
                  </div>
                </ShineBorder>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default UserJourney;
