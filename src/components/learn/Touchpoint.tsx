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
              className="relative w-8 h-8 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center cursor-pointer border-2 border-background shadow-lg"
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
                  ? ['0 0 0 0 rgba(34, 197, 94, 0.7)', '0 0 0 10px rgba(34, 197, 94, 0)']
                  : ['0 0 0 0 rgba(34, 197, 94, 0.4)', '0 0 0 8px rgba(34, 197, 94, 0)']
              }}
              transition={{
                boxShadow: {
                  repeat: Infinity,
                  duration: 2,
                  ease: 'easeOut'
                }
              }}
            >
              <Info className="h-4 w-4 text-white" />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="max-w-xs bg-popover text-popover-foreground p-3 shadow-xl border-2 border-primary/20"
          >
            <div className="space-y-1">
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">{briefText}</p>
              <p className="text-xs text-primary mt-2">Click to learn more</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
}

