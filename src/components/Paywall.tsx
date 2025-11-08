import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { motion } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import debug from '@/utils/debug';
import { useRevenueCatWeb } from '@/hooks/useRevenueCatWeb';
import { useSaleMode } from '@/hooks/useSaleMode';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Package } from '@revenuecat/purchases-js';
import { Marquee } from "@/components/magicui/marquee";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PackageInfo {
  id: string;
  name: string;
  price: string;
  frequency: string;
  description: string;
  features: string[];
  rcPackage: Package | null;
  regularPrice?: string; // Original price for strikethrough when sale is active
  discountPercentage?: number; // Calculated discount percentage
}

interface PaywallProps {
  onPurchaseRequest?: () => void;
  showButton?: boolean;
}

export interface PaywallHandle {
  handlePurchase: () => Promise<void>;
  selectedPlan: 'monthly' | 'yearly' | null;
  purchasing: boolean;
  rcLoading: boolean;
}

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

const Paywall = forwardRef<PaywallHandle, PaywallProps>(({ onPurchaseRequest, showButton = true }, ref) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const { currentOffering, purchase, loading: rcLoading } = useRevenueCatWeb();
  const { isSaleActive, discountPercentage } = useSaleMode();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Map RevenueCat packages to UI
  useEffect(() => {
    if (!currentOffering) {
      debug.error('❌ NO CURRENT OFFERING - Using fallback packages (RevenueCat not configured)');
      debug.log('Sale mode active:', isSaleActive);
      // Fallback packages when RevenueCat is not available
      setPackages([
        {
          id: 'monthly',
          name: 'Monthly',
          price: 'N/A',
          frequency: '/mo',
          description: 'Billed monthly',
          features: ['Everything in Season Pass!'],
          rcPackage: null,
        },
        {
          id: 'yearly',
          name: 'Season Pass',
          price: 'N/A',
          frequency: '/mo',
          description: 'Best value',
          features: [
            'Access to all picks',
            'All Sports',
            'Advanced analytics',
            'Mobile app access',
            'Discord community',
            'Auto-pick notifications',
            'AI with live model data',
          ],
          rcPackage: null,
        },
      ]);
      return;
    }

    debug.log('✅ CURRENT OFFERING EXISTS');
    debug.log('Available packages count:', currentOffering.availablePackages?.length);
    debug.log('Available package identifiers:', currentOffering.availablePackages?.map((pkg: Package) => pkg.identifier));
    debug.log('Sale mode active:', isSaleActive);
    
    // Log each package details
    currentOffering.availablePackages?.forEach((pkg: Package, index: number) => {
      debug.log(`Package ${index + 1}:`, {
        identifier: pkg.identifier,
        productId: pkg.rcBillingProduct?.identifier,
        price: pkg.rcBillingProduct?.currentPrice?.formattedPrice,
        priceAmount: pkg.rcBillingProduct?.currentPrice?.amount,
      });
    });

    // Fetch BOTH regular and discount packages simultaneously
    debug.log('🔍 Fetching both regular and discount packages');
    
    // Find regular packages
    const regularMonthlyPkg = currentOffering.monthly || 
      currentOffering.availablePackages?.find((pkg: Package) => 
        pkg.identifier === '$rc_monthly' || 
        (pkg.identifier.toLowerCase().includes('month') && !pkg.identifier.toLowerCase().includes('discount'))
      );

    const regularYearlyPkg = currentOffering.annual ||
      currentOffering.availablePackages?.find((pkg: Package) => 
        pkg.identifier === '$rc_annual' || 
        ((pkg.identifier.toLowerCase().includes('year') || pkg.identifier.toLowerCase().includes('annual')) && 
         !pkg.identifier.toLowerCase().includes('discount'))
      );

    // Find discount packages
    const discountMonthlyPkg = currentOffering.availablePackages?.find((pkg: Package) => 
      pkg.identifier === '$rc_monthly_discount' || 
      (pkg.identifier.toLowerCase().includes('monthly') && pkg.identifier.toLowerCase().includes('discount'))
    );

    const discountYearlyPkg = currentOffering.availablePackages?.find((pkg: Package) => 
      pkg.identifier === '$rc_yearly_discount' || 
      (pkg.identifier.toLowerCase().includes('year') && pkg.identifier.toLowerCase().includes('discount'))
    );

    debug.log('📦 Package search results:');
    debug.log('Regular Monthly:', regularMonthlyPkg ? {
      identifier: regularMonthlyPkg.identifier,
      price: regularMonthlyPkg.rcBillingProduct?.currentPrice?.formattedPrice,
      amount: regularMonthlyPkg.rcBillingProduct?.currentPrice?.amount,
    } : 'Not found');
    debug.log('Regular Yearly:', regularYearlyPkg ? {
      identifier: regularYearlyPkg.identifier,
      price: regularYearlyPkg.rcBillingProduct?.currentPrice?.formattedPrice,
      amount: regularYearlyPkg.rcBillingProduct?.currentPrice?.amount,
    } : 'Not found');
    debug.log('Discount Monthly:', discountMonthlyPkg ? {
      identifier: discountMonthlyPkg.identifier,
      price: discountMonthlyPkg.rcBillingProduct?.currentPrice?.formattedPrice,
      amount: discountMonthlyPkg.rcBillingProduct?.currentPrice?.amount,
    } : 'Not found');
    debug.log('Discount Yearly:', discountYearlyPkg ? {
      identifier: discountYearlyPkg.identifier,
      price: discountYearlyPkg.rcBillingProduct?.currentPrice?.formattedPrice,
      amount: discountYearlyPkg.rcBillingProduct?.currentPrice?.amount,
    } : 'Not found');

    const rcPackages: PackageInfo[] = [];

    // Helper function to calculate discount percentage
    const calculateDiscount = (regularAmount: number | undefined, discountAmount: number | undefined): number | undefined => {
      if (!regularAmount || !discountAmount || regularAmount === 0) return undefined;
      return Math.round(((regularAmount - discountAmount) / regularAmount) * 100);
    };

    // Process monthly package
    const monthlyPkg = isSaleActive ? discountMonthlyPkg : regularMonthlyPkg;
    const monthlyRegularPkg = regularMonthlyPkg;
    
    if (monthlyPkg) {
      const product = monthlyPkg.rcBillingProduct;
      const regularProduct = monthlyRegularPkg?.rcBillingProduct;
      
      const price = product?.currentPrice?.formattedPrice || 'N/A';
      const regularPrice = isSaleActive && regularProduct?.currentPrice?.formattedPrice 
        ? regularProduct.currentPrice.formattedPrice 
        : undefined;
      
      // Calculate discount percentage
      const regularAmount = regularProduct?.currentPrice?.amount;
      const discountAmount = isSaleActive ? product?.currentPrice?.amount : undefined;
      const calculatedDiscount = isSaleActive 
        ? calculateDiscount(regularAmount, discountAmount)
        : undefined;

      rcPackages.push({
        id: 'monthly',
        name: 'Monthly',
        price: price,
        frequency: '/mo',
        description: 'Billed monthly',
        features: ['Everything in Season Pass!'],
        rcPackage: monthlyPkg,
        regularPrice: regularPrice,
        discountPercentage: calculatedDiscount,
      });
    }

    // Process yearly package
    const yearlyPkg = isSaleActive ? discountYearlyPkg : regularYearlyPkg;
    const yearlyRegularPkg = regularYearlyPkg;
    
    if (yearlyPkg) {
      const product = yearlyPkg.rcBillingProduct;
      const regularProduct = yearlyRegularPkg?.rcBillingProduct;
      
      // Amount is in cents, so divide by 100 to get dollars
      const priceInDollars = product?.currentPrice?.amount ? product.currentPrice.amount / 100 : 0;
      const monthlyEquivalent = priceInDollars > 0 ? (priceInDollars / 12).toFixed(2) : '0.00';
      const formattedYearlyPrice = product?.currentPrice?.formattedPrice || 'N/A';
      
      // Get regular yearly price for strikethrough
      const regularYearlyPrice = isSaleActive && regularProduct?.currentPrice?.formattedPrice
        ? regularProduct.currentPrice.formattedPrice
        : undefined;
      
      // Calculate discount percentage
      const regularAmount = regularProduct?.currentPrice?.amount;
      const discountAmount = isSaleActive ? product?.currentPrice?.amount : undefined;
      const calculatedDiscount = isSaleActive
        ? calculateDiscount(regularAmount, discountAmount)
        : undefined;

      rcPackages.push({
        id: 'yearly',
        name: 'Season Pass',
        price: `$${monthlyEquivalent}`,
        frequency: '/mo',
        description: `Billed yearly (${formattedYearlyPrice})`,
        features: [
          'Access to all picks',
          'All Sports',
          'Advanced analytics',
          'Mobile app access',
          'Discord community',
          'Auto-pick notifications',
          'AI with live model data',
        ],
        rcPackage: yearlyPkg,
        regularPrice: regularYearlyPrice,
        discountPercentage: calculatedDiscount,
      });
    }

    debug.log('✅ Final mapped packages for UI:', rcPackages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      regularPrice: pkg.regularPrice,
      discountPercentage: pkg.discountPercentage,
      hasRcPackage: !!pkg.rcPackage,
      rcPackageId: pkg.rcPackage?.identifier,
    })));
    
    if (rcPackages.some(pkg => !pkg.rcPackage)) {
      debug.error('⚠️ WARNING: Some packages do not have RevenueCat packages attached!');
      debug.error('Packages without RC:', rcPackages.filter(pkg => !pkg.rcPackage).map(pkg => pkg.id));
    }

    if (rcPackages.length > 0) {
      setPackages(rcPackages);
    } else {
      debug.error('❌ NO PACKAGES FOUND in offering, using fallback');
      // Fallback when no packages found
      setPackages([
        {
          id: 'monthly',
          name: 'Monthly',
          price: 'N/A',
          frequency: '/mo',
          description: 'Billed monthly',
          features: ['Everything in Season Pass!'],
          rcPackage: null,
        },
        {
          id: 'yearly',
          name: 'Season Pass',
          price: 'N/A',
          frequency: '/mo',
          description: 'Billed yearly',
          features: [
            'Access to all picks',
            'All Sports',
            'Advanced analytics',
            'Mobile app access',
            'Discord community',
            'Auto-pick notifications',
            'AI with live model data',
          ],
          rcPackage: null,
        },
      ]);
    }
  }, [currentOffering, isSaleActive]);

  const competitorCard = {
    id: 'competitors',
    name: 'Our Competitors',
    details: [
      'Charge $80+ per week',
      'Only picks and/or lists',
      'No transparency on picks',
      'No mobile app',
      'No auto-pick notifications',
      'No AI with live data',
    ],
  };

  const handleSelectPlan = (planId: 'monthly' | 'yearly') => {
    debug.log('🎯 Plan selected:', planId);
    const selectedPackageInfo = packages.find(p => p.id === planId);
    debug.log('Selected package info:', {
      id: selectedPackageInfo?.id,
      name: selectedPackageInfo?.name,
      price: selectedPackageInfo?.price,
      hasRcPackage: !!selectedPackageInfo?.rcPackage,
      rcPackageId: selectedPackageInfo?.rcPackage?.identifier,
    });
    setSelectedPlan(planId);
  };

  const handleNotRightNow = async () => {
    debug.log('🚪 "Not Right Now" clicked - enabling freemium mode');
    
    // Set localStorage flag to indicate user bypassed paywall
    localStorage.setItem('wagerproof_paywall_bypassed', 'true');
    
    // Fetch user's onboarding data to determine which sport page to redirect to
    try {
      if (!user) {
        debug.warn('No user found, redirecting to NFL by default');
        navigate('/nfl');
        return;
      }

      const { data: profile, error } = await (supabase as any)
        .from('profiles')
        .select('onboarding_data')
        .eq('user_id', user.id)
        .single();

      if (error) {
        debug.error('Error fetching profile:', error);
        navigate('/nfl'); // Default to NFL on error
        return;
      }

      const onboardingData = profile?.onboarding_data as { favoriteSports?: string[] } | null;
      const favoriteSports = onboardingData?.favoriteSports || [];
      
      debug.log('User favorite sports:', favoriteSports);

      // Redirect to College Football if it's in favorites, otherwise NFL
      if (favoriteSports.includes('College Football')) {
        debug.log('Redirecting to College Football page');
        navigate('/college-football');
      } else {
        debug.log('Redirecting to NFL page');
        navigate('/nfl');
      }
    } catch (err) {
      debug.error('Unexpected error fetching user data:', err);
      navigate('/nfl'); // Default to NFL on error
    }
  };

  const handleJoinWagerProof = async () => {
    debug.log('🛒 CHECKOUT BUTTON CLICKED');
    
    if (!selectedPlan) {
      debug.error('❌ No plan selected');
      toast({
        title: 'Please select a plan',
        description: 'Choose a subscription plan to continue.',
        variant: 'destructive',
      });
      return;
    }

    debug.log('Selected plan ID:', selectedPlan);
    debug.log('Available packages:', packages.map(p => ({ id: p.id, hasRcPackage: !!p.rcPackage })));
    
    const selectedPackageInfo = packages.find(p => p.id === selectedPlan);
    
    debug.log('Found selected package info:', {
      found: !!selectedPackageInfo,
      id: selectedPackageInfo?.id,
      hasRcPackage: !!selectedPackageInfo?.rcPackage,
      rcPackageIdentifier: selectedPackageInfo?.rcPackage?.identifier,
    });
    
    if (!selectedPackageInfo?.rcPackage) {
      debug.error('❌ PACKAGE NOT AVAILABLE ERROR');
      debug.error('Selected plan:', selectedPlan);
      debug.error('Package found:', !!selectedPackageInfo);
      debug.error('RC Package attached:', !!selectedPackageInfo?.rcPackage);
      debug.error('All packages:', packages);
      debug.error('Current offering:', currentOffering);
      debug.error('Sale mode active:', isSaleActive);
      
      toast({
        title: 'Package not available',
        description: 'Unable to load subscription options. Please refresh the page.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPurchasing(true);
      debug.log('💳 Initiating RevenueCat purchase for:', selectedPlan);
      debug.log('Purchasing package:', selectedPackageInfo.rcPackage.identifier);
      
      await purchase(selectedPackageInfo.rcPackage);
      
      toast({
        title: 'Purchase successful!',
        description: 'Welcome to WagerProof Pro! Redirecting to homepage...',
      });
      
      debug.log('Purchase completed successfully');
      
      // Redirect to homepage after successful purchase
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error: any) {
      debug.error('Purchase error:', error);
      
      // Don't show error for user cancellations
      if (error.message === 'USER_CANCELLED') {
        debug.log('User cancelled purchase');
        return;
      }
      
      toast({
        title: 'Purchase failed',
        description: error.message || 'Unable to complete purchase. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPurchasing(false);
    }
  };

  // Expose handler and state via ref
  useImperativeHandle(ref, () => ({
    handlePurchase: handleJoinWagerProof,
    selectedPlan,
    purchasing,
    rcLoading,
  }));

  return (
    <div className="flex flex-col items-center justify-center text-center p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
      {isSaleActive && (() => {
        // Get the discount percentage from packages (prefer yearly if available, otherwise monthly)
        const yearlyPkg = packages.find(p => p.id === 'yearly');
        const monthlyPkg = packages.find(p => p.id === 'monthly');
        const displayDiscount = yearlyPkg?.discountPercentage || monthlyPkg?.discountPercentage || discountPercentage;
        
        return (
          <motion.div
            className="mb-4 px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm sm:text-base"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            🔥 LIMITED TIME SALE - {displayDiscount}% OFF! 🔥
          </motion.div>
        );
      })()}
      
      <motion.h1
        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 sm:mb-8 md:mb-10 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Choose Your Plan
      </motion.h1>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 lg:gap-8 w-full mb-10 sm:mb-12 md:mb-16"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {packages.map(({ id, name, price, frequency, description, features, regularPrice, discountPercentage: pkgDiscountPercentage }) => (
          <motion.div
            key={id}
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              visible: { opacity: 1, scale: 1 },
            }}
          >
            <Card
              onClick={() => handleSelectPlan(id as 'monthly' | 'yearly')}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 h-full relative",
                selectedPlan === id
                  ? "border-green-400 ring-2 ring-green-400 bg-green-400/20"
                  : "border-white/20"
              )}
            >
              {id === 'yearly' && (
                <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 rounded-tr-lg rounded-bl-lg text-xs sm:text-sm font-semibold">
                  Best Value
                </div>
              )}
              {id === 'monthly' && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 rounded-tr-lg rounded-bl-lg text-xs sm:text-sm font-semibold">
                  Most Flexible
                </div>
              )}
              <CardContent className="p-6 sm:p-8 flex flex-col items-start justify-start h-full">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2 w-full text-center">{name}</h3>
                
                {isSaleActive && regularPrice ? (
                  <div className="w-full text-center mb-1">
                    <p className="text-lg sm:text-xl text-white/50 line-through mb-1">
                      {regularPrice}
                      <span className="text-sm font-normal">{id === 'monthly' ? '/mo' : '/yr'}</span>
                    </p>
                    <p className="text-3xl sm:text-4xl font-bold text-green-400">
                      {price}<span className="text-sm sm:text-base font-normal">{frequency}</span>
                    </p>
                    {pkgDiscountPercentage !== undefined && (
                      <p className="text-xs sm:text-sm text-green-300 font-semibold">
                        Save {pkgDiscountPercentage}%!
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-3xl sm:text-4xl font-bold text-white mb-1 w-full text-center">
                    {price}<span className="text-sm sm:text-base font-normal">{frequency}</span>
                  </p>
                )}
                
                <p className="text-xs sm:text-sm text-white/70 mb-4 w-full text-center">{description}</p>
                <ul className="space-y-2 w-full">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span className="text-xs sm:text-sm text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Competitor Card */}
        <motion.div
          variants={{
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1 },
          }}
        >
          <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/5 transition-all duration-200 opacity-60 h-full">
            <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-start">
              <h3 className="text-lg sm:text-xl font-semibold text-white/70 mb-4">{competitorCard.name}</h3>
              <ul className="space-y-2 text-left w-full">
                {competitorCard.details.map((detail, index) => (
                  <li key={index} className="flex items-start">
                    <svg className="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    <span className="text-xs sm:text-sm text-white/60">{detail}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Testimonials Section */}
      <motion.div
        className="w-full mb-10 sm:mb-12 md:mb-16"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <motion.h2
          className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          Trusted by data-driven bettors
        </motion.h2>
        <motion.p
          className="text-base sm:text-lg md:text-xl text-white/80 mb-6 sm:mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          See what our community is saying
        </motion.p>
        
        {/* Reviews carousel - edge to edge */}
        <div className="w-auto -mx-4 sm:-mx-6 md:-mx-8 lg:-mx-10 relative overflow-hidden">
          <div className="flex w-full flex-col items-center justify-center overflow-hidden">
            <Marquee className="[--duration:30s]">
              {testimonials.map((review) => (
                <ReviewCard key={review.name} {...review} />
              ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-black/30 to-transparent"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black/30 to-transparent"></div>
          </div>
        </div>
      </motion.div>

      {showButton && (
        <motion.div
          className="flex flex-col gap-4 items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Button
            onClick={handleJoinWagerProof}
            size="lg"
            disabled={!selectedPlan || purchasing || rcLoading}
            className="bg-green-500 hover:bg-green-600 text-white border-0 px-8 py-6 text-lg disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {purchasing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : rcLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Go to Checkout'
            )}
          </Button>
          
          <Button
            onClick={handleNotRightNow}
            variant="ghost"
            size="lg"
            className="text-white/80 hover:text-white hover:bg-white/10 px-8 py-6 text-base"
          >
            Not Right Now
          </Button>
        </motion.div>
      )}
    </div>
  );
});

Paywall.displayName = 'Paywall';

export default Paywall;
