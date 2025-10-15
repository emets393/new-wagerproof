import React from "react";
import LandingNavBar from "@/components/landing/LandingNavBar";
import Hero from "@/components/landing/Hero";
import RecipeImport from "@/components/landing/RecipeImport";
import UserJourney from "@/components/landing/UserJourney";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import Footer from "@/components/landing/Footer";
import { useRandomNotifications } from "@/hooks/useRandomNotifications";
import { SEO } from "@/components/landing/SEO";
import { StructuredData } from "@/components/landing/StructuredData";

const NewLanding = () => {
  useRandomNotifications();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
      <SEO
        title="WagerProof - Data-Driven Sports Betting Analytics"
        description="Professional sports betting analytics powered by real data. Get predictions and insights for NFL, College Football, NBA, and more. Access advanced analytics tools today."
        ogType="website"
      />
      <StructuredData type="organization" />
      <StructuredData type="website" />
      <LandingNavBar />
      <Hero />
      <div className="space-y-6">
        <RecipeImport />
        <UserJourney />
        <Testimonials />
        <Pricing />
      </div>
      <Footer />
    </div>
  );
};

export default NewLanding;

