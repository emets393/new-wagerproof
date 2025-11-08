import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export function AnnouncementsBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const { data: announcement, isLoading } = useQuery({
    queryKey: ['announcement-banner'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_announcement_banner');
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refetch every minute to check for updates
  });

  // Don't show if loading, not published, no message, or dismissed
  if (isLoading || !announcement?.published || !announcement?.message || dismissed) {
    return null;
  }

  return (
    <div 
      className={`w-full border-b backdrop-blur-sm ${
        isDark 
          ? 'bg-gradient-to-r from-green-600/30 to-green-700/30 border-green-500/40' 
          : 'bg-gradient-to-r from-green-100 to-green-200 border-green-300/50'
      }`}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <p className={`text-sm md:text-base flex-1 text-center md:text-left ${
            isDark ? 'text-white' : 'text-green-900'
          }`}>
            <span className="font-semibold">📢 Announcement:</span> {announcement.message}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className={`h-6 w-6 flex-shrink-0 ${
              isDark 
                ? 'text-white hover:bg-white/20' 
                : 'text-green-900 hover:bg-green-300/30'
            }`}
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

