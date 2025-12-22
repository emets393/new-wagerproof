import React, { useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import LandingNavBar from "@/components/landing/LandingNavBar";
import Hero from "@/components/landing/Hero";
import RecipeImport from "@/components/landing/RecipeImport";
import UserJourney from "@/components/landing/UserJourney";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/landing/Footer";
import { FeatureDemo } from "@/components/landing/FeatureDemo";
import { CompetitorComparison } from "@/components/landing/CompetitorComparison";
import { BetSlipGraderCTA } from "@/components/landing/BetSlipGraderCTA";
import { useRandomNotifications } from "@/hooks/useRandomNotifications";
import { SEO } from "@/components/landing/SEO";
import { StructuredData } from "@/components/landing/StructuredData";
import FloatingThemeToggle from "@/components/FloatingThemeToggle";

import UserWinsSection from "@/components/landing/UserWinsSection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const NewLanding = () => {
  const { theme } = useTheme();
  useRandomNotifications();
  
  const { data: showUserWins, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['landing-show-user-wins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('show_user_wins_section')
        .single();
      
      if (error) {
        console.error('Error fetching show_user_wins_section:', error);
        return false;
      }
      const result = (data as any)?.show_user_wins_section || false;
      console.log('show_user_wins_section value:', result);
      return result;
    },
    staleTime: 0, // Always refetch
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Ensure page always loads at the top
  useEffect(() => {
    // Scroll to top immediately on mount
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    // Also handle any delayed scroll attempts from child components
    const preventScroll = () => {
      if (window.scrollY > 100) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    };
    
    // Monitor for unwanted scrolls in the first 2 seconds
    const timeoutId = setTimeout(() => {
      preventScroll();
    }, 500);
    
    const timeoutId2 = setTimeout(() => {
      preventScroll();
    }, 1500);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
    };
  }, []);

  const faqQuestions = [
    {
      question: "What is WagerProof?",
      answer: "WagerProof is a data-driven sports betting analytics platform that provides professional-grade predictions, insights, and advanced analytics tools for NFL, College Football, NBA, and other major sports. We use real data and sophisticated models to help users make informed betting decisions."
    },
    {
      question: "How accurate are WagerProof's predictions?",
      answer: "Our predictions are powered by advanced statistical models and real-time data analysis. While no prediction system can guarantee 100% accuracy, our models are continuously refined to provide the most reliable insights possible based on historical patterns, team performance, and betting market trends."
    },
    {
      question: "What sports does WagerProof cover?",
      answer: "WagerProof currently covers NFL, College Football, NBA, and other major sports. We provide comprehensive analytics, predictions, and betting insights for each sport with dedicated tools and models."
    },
    {
      question: "Do I need to be an expert to use WagerProof?",
      answer: "No! WagerProof is designed for both beginners and experienced bettors. Our platform provides easy-to-understand insights and recommendations, while also offering advanced analytics tools for those who want to dive deeper into the data."
    },
    {
      question: "Do you have data on Player Props?",
      answer: "No. Player Props are currently not covered by WagerProof. We focus on the highest probability bets that have the best value, not the lowest probability bets that have the best payouts."
    },
    {
      question: "Is WagerProof a gambling site?",
      answer: "No, WagerProof is not a gambling operator or bookmaker. We provide analytical tools, predictions, and insights to help you make informed decisions. You are responsible for your own betting decisions and compliance with local gambling laws."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
      <SEO
        title="WagerProof - Data-Driven Sports Betting Analytics"
        description="Professional sports betting analytics powered by real data. Get predictions and insights for NFL, College Football, NBA, and more. Access advanced analytics tools today."
        ogType="website"
      />
      <StructuredData type="organization" />
      <StructuredData type="website" />
      <StructuredData type="faq" questions={faqQuestions} />
      <LandingNavBar />
      <Hero />
      <div className="space-y-6">
        <RecipeImport />
        <FeatureDemo />
        {/* Debug: showUserWins = {String(showUserWins)}, isLoadingSettings = {String(isLoadingSettings)} */}
        {showUserWins === true && <UserWinsSection />}
        <UserJourney />
        <CompetitorComparison />

        {/* Product Hunt Badge */}
        <div className="flex items-center justify-center py-8">
          <a
            href="https://www.producthunt.com/products/wagerproof?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-wagerproof"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1036620&theme=${theme === 'dark' ? 'dark' : 'light'}&t=1762805140599`}
              alt="WagerProof - Data-driven sports betting analytics | Product Hunt"
              style={{ width: '250px', height: '54px' }}
              width="250"
              height="54"
            />
          </a>
        </div>

        <Testimonials />
        <BetSlipGraderCTA />
        <FAQ questions={faqQuestions} />
        {/* <Pricing /> */}
      </div>
      <Footer />
      <FloatingThemeToggle />
    </div>
  );
};

export default NewLanding;

