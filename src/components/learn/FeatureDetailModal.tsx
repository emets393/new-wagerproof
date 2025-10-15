import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface DetailStep {
  title: string;
  description: string;
  tip?: string;
}

interface FeatureDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  steps: DetailStep[];
}

export function FeatureDetailModal({ isOpen, onClose, title, steps }: FeatureDetailModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
        </DialogHeader>

        {/* Step Progress Indicator */}
        <div className="flex items-center justify-center gap-2 my-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? 'w-8 bg-primary'
                  : index < currentStep
                  ? 'w-2 bg-primary/50'
                  : 'w-2 bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 py-4"
          >
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="text-sm">
                Step {currentStep + 1} of {steps.length}
              </Badge>
            </div>

            <h3 className="text-xl font-semibold text-foreground">
              {steps[currentStep].title}
            </h3>

            <p className="text-base text-muted-foreground leading-relaxed">
              {steps[currentStep].description}
            </p>

            {steps[currentStep].tip && (
              <div className="bg-primary/10 border-l-4 border-primary rounded-r-lg p-4 mt-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-foreground mb-1">Pro Tip</p>
                    <p className="text-sm text-muted-foreground">
                      {steps[currentStep].tip}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleClose}
              variant="default"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Done
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

