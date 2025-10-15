import React from "react";
import { cn } from "@/lib/utils";

interface Iphone15ProProps {
  className?: string;
  videoSrc: string;
}

const Iphone15Pro: React.FC<Iphone15ProProps> = ({ className, videoSrc }) => {
  return (
    <div className={cn("relative", className)}>
      <div className="relative h-[667px] w-[320px] md:h-[667px] md:w-[320px] bg-gradient-to-br from-gray-200 to-gray-300 shadow-2xl rounded-[2.5rem] border-[6px] border-gray-700/60 flex items-center justify-center overflow-hidden">
        {/* Side button */}
        <div className="absolute right-0 top-36 w-1 h-14 rounded-full bg-gray-300"></div>
        
        {/* Screen content */}
        <div className="relative z-10 w-full h-full rounded-[2rem] overflow-hidden shadow-lg">
          <video 
            className="w-full h-full object-cover" 
            autoPlay 
            muted 
            loop 
            playsInline 
            src={videoSrc} 
          />
        </div>
        
        {/* Light reflection */}
        <div className="absolute left-4 top-6 h-40 w-36 bg-white/30 rounded-full blur-2xl rotate-12 opacity-60 pointer-events-none"></div>
      </div>
    </div>
  );
};

export default Iphone15Pro;