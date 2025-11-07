import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import debug from '@/utils/debug';
import { useRevenueCatWeb } from '@/hooks/useRevenueCatWeb';
import { useSaleMode } from '@/hooks/useSaleMode';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Package } from '@revenuecat/purchases-js';

interface PackageInfo {
  id: string;
  name: string;
  price: string;
  frequency: string;
  description: string;
  features: string[];
  rcPackage: Package | null;
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

const Paywall = forwardRef<PaywallHandle, PaywallProps>(({ onPurchaseRequest, showButton = true }, ref) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const { currentOffering, purchase, loading: rcLoading } = useRevenueCatWeb();
  const { isSaleActive, discountPercentage } = useSaleMode();
  const { toast } = useToast();

  // Map RevenueCat packages to UI
  useEffect(() => {
    if (!currentOffering) {
      debug.log('No current offering available, using fallback packages');
      // Default fallback packages based on sale mode
      setPackages([
        {
          id: 'monthly',
          name: 'Monthly',
          price: isSaleActive ? '$20' : '$40',
          frequency: '/mo',
          description: 'Billed monthly',
          features: ['Everything in Season Pass!'],
          rcPackage: null,
        },
        {
          id: 'yearly',
          name: 'Season Pass',
          price: isSaleActive ? '$99' : '$199',
          frequency: '/yr',
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

    debug.log('Current offering available packages:', currentOffering.availablePackages);
    debug.log('Sale mode active:', isSaleActive);

    const rcPackages: PackageInfo[] = [];

    // Try to find monthly and annual packages by identifier
    // Handle both regular and discount packages based on sale mode
    const monthlyPkg = isSaleActive
      ? currentOffering.availablePackages?.find((pkg: Package) => 
          pkg.identifier === '$rc_monthly_discount' || 
          pkg.identifier.toLowerCase().includes('monthly') && pkg.identifier.toLowerCase().includes('discount')
        )
      : currentOffering.monthly || 
        currentOffering.availablePackages?.find((pkg: Package) => 
          pkg.identifier === '$rc_monthly' || 
          (pkg.identifier.toLowerCase().includes('month') && !pkg.identifier.toLowerCase().includes('discount'))
        );

    const yearlyPkg = isSaleActive
      ? currentOffering.availablePackages?.find((pkg: Package) => 
          pkg.identifier === '$rc_yearly_discount' || 
          pkg.identifier.toLowerCase().includes('year') && pkg.identifier.toLowerCase().includes('discount')
        )
      : currentOffering.annual ||
        currentOffering.availablePackages?.find((pkg: Package) => 
          pkg.identifier === '$rc_annual' || 
          (pkg.identifier.toLowerCase().includes('year') && !pkg.identifier.toLowerCase().includes('discount')) ||
          (pkg.identifier.toLowerCase().includes('annual') && !pkg.identifier.toLowerCase().includes('discount'))
        );

    debug.log('Found monthly package:', monthlyPkg);
    debug.log('Found yearly package:', yearlyPkg);

    if (monthlyPkg) {
      const product = monthlyPkg.rcBillingProduct;
      const price = product?.currentPrice?.formattedPrice || '$40';
      
      rcPackages.push({
        id: 'monthly',
        name: 'Monthly',
        price: price,
        frequency: '/mo',
        description: 'Billed monthly',
        features: ['Everything in Season Pass!'],
        rcPackage: monthlyPkg,
      });
    }

    if (yearlyPkg) {
      const product = yearlyPkg.rcBillingProduct;
      // Amount is in cents, so divide by 100 to get dollars
      const priceInDollars = product?.currentPrice?.amount ? product.currentPrice.amount / 100 : 199;
      const monthlyEquivalent = (priceInDollars / 12).toFixed(2);
      
      rcPackages.push({
        id: 'yearly',
        name: 'Season Pass',
        price: `$${monthlyEquivalent}`,
        frequency: '/mo',
        description: `Billed yearly (${product?.currentPrice?.formattedPrice || '$199'})`,
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
      });
    }

    debug.log('Mapped packages:', rcPackages);

    if (rcPackages.length > 0) {
      setPackages(rcPackages);
    } else {
      debug.log('No packages found in offering, using fallback');
      // Use fallback if no packages found
      setPackages([
        {
          id: 'monthly',
          name: 'Monthly',
          price: '$40',
          frequency: '/mo',
          description: 'Billed monthly',
          features: ['Everything in Season Pass!'],
          rcPackage: null,
        },
        {
          id: 'yearly',
          name: 'Season Pass',
          price: '$16.58',
          frequency: '/mo',
          description: 'Billed yearly ($199)',
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
    setSelectedPlan(planId);
  };

  const handleJoinWagerProof = async () => {
    if (!selectedPlan) {
      toast({
        title: 'Please select a plan',
        description: 'Choose a subscription plan to continue.',
        variant: 'destructive',
      });
      return;
    }

    const selectedPackageInfo = packages.find(p => p.id === selectedPlan);
    if (!selectedPackageInfo?.rcPackage) {
      toast({
        title: 'Package not available',
        description: 'Unable to load subscription options. Please refresh the page.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPurchasing(true);
      debug.log('Initiating RevenueCat purchase for:', selectedPlan);
      
      await purchase(selectedPackageInfo.rcPackage);
      
      toast({
        title: 'Purchase successful!',
        description: 'Welcome to WagerProof Pro! You now have access to all features.',
      });
      
      debug.log('Purchase completed successfully');
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
    <div className="flex flex-col items-center justify-center text-center p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      {isSaleActive && (
        <motion.div
          className="mb-4 px-4 py-2 bg-red-500 text-white rounded-lg font-bold text-sm sm:text-base"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          🔥 LIMITED TIME SALE - {discountPercentage}% OFF! 🔥
        </motion.div>
      )}
      
      <motion.h1
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6 sm:mb-8 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Choose Your Plan
      </motion.h1>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 w-full mb-8 sm:mb-12"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {packages.map(({ id, name, price, frequency, description, features }) => (
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
                
                {isSaleActive ? (
                  <div className="w-full text-center mb-1">
                    <p className="text-lg sm:text-xl text-white/50 line-through mb-1">
                      {id === 'monthly' ? '$40' : '$199'}
                      <span className="text-sm font-normal">{id === 'monthly' ? '/mo' : '/yr'}</span>
                    </p>
                    <p className="text-3xl sm:text-4xl font-bold text-green-400">
                      {price}<span className="text-sm sm:text-base font-normal">{frequency}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-green-300 font-semibold">
                      Save {discountPercentage}%!
                    </p>
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

      {showButton && (
        <motion.div
          className="flex gap-4 flex-wrap justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Button
            onClick={handleJoinWagerProof}
            size="lg"
            disabled={!selectedPlan || purchasing || rcLoading}
            className="bg-green-500 hover:bg-green-600 text-white border-0 disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
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
        </motion.div>
      )}
    </div>
  );
});

Paywall.displayName = 'Paywall';

export default Paywall;
