import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { Marquee } from "@/components/magicui/marquee";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

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
        // Dark modal background - use white/light backgrounds for visibility
        "border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/15",
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <img className="rounded-full" width="32" height="32" alt="" src={img} />
        <div className="flex flex-col">
          <figcaption className="text-sm font-medium text-white">
            {name}
          </figcaption>
        </div>
      </div>
      <blockquote className="mt-2 text-sm text-white/90">{body}</blockquote>
    </figure>
  );
};

export function SocialProof() {
  const { nextStep } = useOnboarding();

  return (
    <div className="flex flex-col items-center justify-center text-center p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Trusted by data-driven bettors
      </motion.h1>
      <motion.p
        className="text-sm sm:text-base md:text-lg text-white/80 mb-6 sm:mb-8 px-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        See community results, discussions, and model transparency.
      </motion.p>
      
      {/* Reviews carousel - edge to edge */}
      <motion.div 
        className="w-screen -ml-[50vw] left-[50%] relative overflow-hidden my-6 sm:my-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex w-full flex-col items-center justify-center overflow-hidden">
          <Marquee className="[--duration:30s]">
            {testimonials.map((review) => (
              <ReviewCard key={review.name} {...review} />
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-black/30 to-transparent"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black/30 to-transparent"></div>
        </div>
      </motion.div>

      {/* Discord exclusive access notice */}
      <motion.div
        className="flex flex-col items-center gap-3 sm:gap-4 mb-4 sm:mb-6 px-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <div className="flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 sm:px-6 py-3 sm:py-4">
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-[#5865F2] flex-shrink-0" />
          <div className="text-center">
            <p className="text-sm sm:text-base text-white font-medium">All members get exclusive access to our Discord community</p>
            <p className="text-xs sm:text-sm text-white/70">Connect with fellow data-driven bettors</p>
          </div>
        </div>
        
        <Button onClick={nextStep} size="lg" className="bg-green-500 hover:bg-green-600 text-white border-0">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
