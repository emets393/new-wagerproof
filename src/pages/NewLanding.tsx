import React from "react";
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
import { useRandomNotifications } from "@/hooks/useRandomNotifications";
import { SEO } from "@/components/landing/SEO";
import { StructuredData } from "@/components/landing/StructuredData";

const NewLanding = () => {
  useRandomNotifications();

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
        <UserJourney />
        <CompetitorComparison />
        <Testimonials />
        <FAQ questions={faqQuestions} />
        {/* <Pricing /> */}
      </div>
      <Footer />
    </div>
  );
};

export default NewLanding;

