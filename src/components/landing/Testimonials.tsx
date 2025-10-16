
import React from "react";
import { useInViewAnimation } from "@/hooks/useInViewAnimation";
import { Marquee } from "@/components/magicui/marquee";
import { cn } from "@/lib/utils";
import CountUp from "./CountUp";

const testimonials = [
  {
    name: "Sarah M.",
    body: "WagerProof has transformed the way I bet. The data-driven predictions have improved my win rate significantly!",
    img: "https://avatar.vercel.sh/sarah",
  },
  {
    name: "Mark T.",
    body: "I used to bet on gut feelings. Now with WagerProof's analytics, I'm making smarter bets and actually profitable!",
    img: "https://avatar.vercel.sh/mark",
  },
  {
    name: "Priya K.",
    body: "The trend analysis tools have helped me find edges I never knew existed. This platform is a game-changer!",
    img: "https://avatar.vercel.sh/priya",
  },
  {
    name: "James L.",
    body: "The model accuracy tracking gives me confidence in my bets. Finally, a transparent sports betting analytics platform!",
    img: "https://avatar.vercel.sh/james",
  },
  {
    name: "Maria R.",
    body: "The historical data and trend tracking is incredibly accurate! Finally found a platform that's transparent about results.",
    img: "https://avatar.vercel.sh/maria",
  },
  {
    name: "David K.",
    body: "WagerProof has made betting fun again. The interface is intuitive and the predictions are spot on!",
    img: "https://avatar.vercel.sh/david",
  },
];

const firstRow = testimonials.slice(0, testimonials.length / 2);
const secondRow = testimonials.slice(testimonials.length / 2);

const ReviewCard = ({
  img,
  name,
  body,
}: {
  img: string;
  name: string;
  body: string;
}) => {
  return (
    <figure
      className={cn(
        "relative h-full w-56 cursor-pointer overflow-hidden rounded-xl border p-3",
        // light styles
        "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
        // dark styles
        "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]",
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <img className="rounded-full" width="32" height="32" alt="" src={img} />
        <div className="flex flex-col">
          <figcaption className="text-sm font-medium dark:text-white">
            {name}
          </figcaption>
        </div>
      </div>
      <blockquote className="mt-2 text-sm">{body}</blockquote>
    </figure>
  );
};

const Testimonials = () => {
  const [sectionRef, inView] = useInViewAnimation<HTMLDivElement>();

  return (
    <section
      ref={sectionRef}
      className={`py-14 bg-transparent transition-opacity duration-700 ${inView ? "opacity-100 animate-fade-in" : "opacity-0"}`}
    >
      {/* Header Content - Centered */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-3xl mx-auto mb-12 transition-all duration-700 ${inView ? "animate-fade-in" : "opacity-0 translate-y-10"}`}>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            What Our Users Are Saying
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Join thousands of home cooks who have simplified their cooking journey
          </p>
        </div>
      </div>

      {/* Full-width Marquee */}
      <div className="relative w-screen -ml-[50vw] left-[50%] overflow-hidden">
        <div className="flex w-full flex-col items-center justify-center overflow-hidden">
          <Marquee className="[--duration:30s]">
            {firstRow.map((review) => (
              <ReviewCard key={review.name} {...review} />
            ))}
          </Marquee>
          <Marquee reverse className="[--duration:30s]">
            {secondRow.map((review) => (
              <ReviewCard key={review.name} {...review} />
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-gray-100 dark:from-gray-950"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-gray-100 dark:from-gray-950"></div>
        </div>
      </div>

      {/* CTA Content - Centered */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mt-12 text-center transition-all duration-700 ${inView ? "animate-fade-in" : "opacity-0 translate-y-10"}`}>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">Join thousands of bettors already using WagerProof</p>
          <div className="flex items-center justify-center gap-2 text-4xl md:text-5xl font-bold">
            <CountUp
              from={0}
              to={5000}
              separator=","
              direction="up"
              duration={2.5}
              delay={0.5}
              className="text-honeydew-600 dark:text-honeydew-400 font-black"
            />
            <span className="text-honeydew-600 dark:text-honeydew-400 font-black">+</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
