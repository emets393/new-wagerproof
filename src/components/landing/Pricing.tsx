
import React from "react";
import { Check } from "lucide-react";
import { useInViewAnimation } from "@/hooks/useInViewAnimation";

const PricingTier = ({ title, price, description, features, buttonText, highlighted = false, inView, index, subtext }: {
  title: string;
  price: string;
  description: string;
  features: string[];
  buttonText: string;
  highlighted?: boolean;
  inView: boolean;
  index: number;
  subtext?: string;
}) => {
  return <div className={`p-1 rounded-2xl transition-transform duration-700 ${highlighted ? "bg-gradient-to-br from-honeydew-400 to-honeydew-600" : "bg-white dark:bg-gray-800"} ${inView ? "animate-fade-in" : "opacity-0 translate-y-10"}`} style={{
    animationDelay: `${0.11 + index * 0.09}s`
  }}>
      <div className="bg-white dark:bg-gray-800 h-full rounded-xl p-8">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <div className="mb-6">
          <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">{price}</span>
          {price !== "Free" && <span className="text-gray-500 dark:text-gray-400 ml-1">/month</span>}
          {subtext && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtext}</div>}
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{description}</p>

        <ul className="space-y-3 mb-8">
          {features.map((feature, index) => <li key={index} className="flex items-start">
              <Check className="w-5 h-5 text-honeydew-500 mt-0.5 mr-2 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-300">{feature}</span>
            </li>)}
        </ul>

        <button 
          className={`w-full py-3 rounded-lg font-medium ${highlighted ? "bg-gradient-to-r from-honeydew-500 to-honeydew-600 hover:from-honeydew-600 hover:to-honeydew-700 text-white" : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"} text-lg shadow hover-scale transition`} 
          type="button"
          onClick={() => window.location.href = 'https://www.wagerproof.bet/account'}
        >
          {buttonText}
        </button>
      </div>
    </div>;
};

const Pricing = () => {
  const [sectionRef, inView] = useInViewAnimation<HTMLDivElement>();
  const tiers = [{
    title: "Monthly",
    price: "$60",
    description: "Full access to all betting analytics",
    features: ["NFL & College Football predictions", "Advanced trend analysis tools", "Live odds tracking", "Historical performance data", "Model accuracy tracking", "Daily betting insights"],
    buttonText: "Start Monthly",
    highlighted: false
  }, {
    title: "Annual",
    price: "$16.58",
    description: "Best value - Save over 65%",
    features: ["Everything in Monthly", "NBA & MLB predictions (coming soon)", "Priority feature access", "Advanced analytics dashboard", "Custom model building tools", "Expert betting education", "Priority support", "Cancel anytime"],
    buttonText: "Start Annual - Save $521",
    highlighted: true,
    subtext: "$199 billed annually"
  }];
  
  return (
    <section 
      id="pricing" 
      ref={sectionRef} 
      className={`py-20 bg-transparent transition-opacity duration-700 ${inView ? "opacity-100 animate-fade-in" : "opacity-0"}`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ${inView ? "animate-fade-in" : "opacity-0 translate-y-10"}`}>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Choose Your Plan
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Professional sports betting analytics at your fingertips
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {tiers.map((tier, index) => (
            <PricingTier key={tier.title} {...tier} inView={inView} index={index} subtext={tier.subtext} />
          ))}
        </div>

        <div className={`mt-16 max-w-3xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-honeydew-100 dark:border-gray-700 transition-all duration-700 ${inView ? "animate-fade-in" : "opacity-0 translate-y-10"}`}>
          <h3 className="text-xl font-semibold text-center text-gray-900 dark:text-gray-100 mb-6">Frequently Asked Questions</h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Can I cancel anytime?</h4>
              <p className="text-gray-600 dark:text-gray-300">Yes, you can cancel your subscription at any time with no penalties or fees.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">How accurate are the predictions?</h4>
              <p className="text-gray-600 dark:text-gray-300">We track all model performance in real-time. Historical accuracy rates are displayed for full transparency.</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">What sports are covered?</h4>
              <p className="text-gray-600 dark:text-gray-300">Currently NFL and College Football, with NBA and MLB coming soon for all subscribers.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
