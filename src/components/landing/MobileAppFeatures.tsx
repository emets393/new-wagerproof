import { motion } from "framer-motion";

const features = [
  {
    image: "/lovable-uploads/screenshots_mobile_nobackground/01 _make_decisions_with_pro_data.png",
    title: "Professional Analytics on your phone or web.",
    subtitle: "Access professional-grade analytics and real-time insights to inform every bet"
  },
  {
    image: "/lovable-uploads/screenshots_mobile_nobackground/02 _its_like_clippy_for_sports_betting.png",
    title: "Your Personal Betting Assistant",
    subtitle: "AI-powered guidance that helps you navigate odds and find value"
  },
  {
    image: "/lovable-uploads/screenshots_mobile_nobackground/03_get_expert_picks.png",
    title: "Get Expert Picks",
    subtitle: "Curated selections from data-driven models with transparent track records"
  },
  {
    image: "/lovable-uploads/screenshots_mobile_nobackground/04_AI_with_real_live_data_and_models_no_hallucinations.png",
    title: "AI with Real Live Data",
    subtitle: "No hallucinations — just accurate predictions from verified sports data"
  },
  {
    image: "/lovable-uploads/screenshots_mobile_nobackground/05_Value_alerts_from_comparing_prediction_markets_with_vegas.png",
    title: "Value Alerts",
    subtitle: "Spot opportunities by comparing prediction markets with Vegas lines"
  },
  {
    image: "/lovable-uploads/screenshots_mobile_nobackground/07_private_discord_with_developers_and_other_expert_bettors.png",
    title: "Private Discord Community",
    subtitle: "Connect with developers and expert bettors in an exclusive community"
  }
];

export function MobileAppFeatures() {
  return (
    <section className="bg-white dark:bg-gray-900">
      {features.map((feature, index) => {
        const isEven = index % 2 === 0;
        
        return (
          <div
            key={index}
            className="flex items-center justify-center px-4 md:px-8 lg:px-16 py-8 md:py-12"
          >
            <div className={`
              max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center
              ${isEven ? '' : 'md:[direction:rtl]'}
            `}>
              {/* Screenshot */}
              <motion.div
                className={`flex justify-center ${isEven ? '' : 'md:[direction:ltr]'}`}
                initial={{ opacity: 0, x: isEven ? -80 : 80 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <motion.img
                  src={feature.image}
                  alt={feature.title}
                  className="w-48 md:w-56 lg:w-64 h-auto object-contain drop-shadow-2xl"
                  loading="lazy"
                  whileHover={{ scale: 1.03, rotate: isEven ? 2 : -2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                />
              </motion.div>
              
              {/* Text Content */}
              <motion.div
                className={`text-center md:text-left ${isEven ? '' : 'md:[direction:ltr]'}`}
                initial={{ opacity: 0, x: isEven ? 80 : -80 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
                  {feature.title}
                </h3>
                <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-md">
                  {feature.subtitle}
                </p>
              </motion.div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default MobileAppFeatures;
