import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TouchpointProps {
  id: string;
  position: { x: number; y: number };
  title: string;
  briefText: string;
  onClick: () => void;
  isActive?: boolean;
}

export function Touchpoint({ position, title, briefText, onClick, isActive = false }: TouchpointProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 20
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.3 }}
    >
      <TooltipProvider delayDuration={200}>
        <Tooltip open={isHovered}>
          <TooltipTrigger asChild>
            <motion.button
              className="relative w-12 h-12 rounded-full bg-primary/90 hover:bg-primary dark:bg-blue-400 dark:hover:bg-blue-300 flex items-center justify-center cursor-pointer border-3 border-background shadow-xl"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={() => {
                setIsHovered(false);
                onClick();
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: isActive
                  ? [
                      '0 0 0 0 rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.6)', 
                      '0 0 0 20px rgba(59, 130, 246, 0), 0 0 40px rgba(59, 130, 246, 0)'
                    ]
                  : [
                      '0 0 0 0 rgba(59, 130, 246, 0.6), 0 0 15px rgba(59, 130, 246, 0.4)', 
                      '0 0 0 15px rgba(59, 130, 246, 0), 0 0 30px rgba(59, 130, 246, 0)'
                    ]
              }}
              transition={{
                boxShadow: {
                  repeat: Infinity,
                  duration: 2,
                  ease: 'easeOut'
                }
              }}
            >
              <Info className="h-6 w-6 text-white" />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent 
            side="top"
            className="max-w-md w-80 bg-popover dark:bg-gray-100 text-popover-foreground dark:text-gray-900 p-6 shadow-xl border-2 border-primary/20 dark:border-gray-300"
          >
            <div className="space-y-3">
              <p className="font-semibold text-lg">{title}</p>
              <p className="text-sm text-muted-foreground dark:text-gray-700 leading-relaxed">{briefText}</p>
              <p className="text-sm text-primary dark:text-blue-700 mt-3 font-medium">Click to learn more</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
}

