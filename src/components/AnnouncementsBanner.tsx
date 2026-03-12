import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Megaphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

interface AnnouncementData {
  title: string | null;
  message: string | null;
  published: boolean;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  updated_at: string | null;
}

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
      return data as AnnouncementData;
    },
    refetchInterval: 60000,
  });

  // Don't show if loading, not published, no message, or dismissed
  if (isLoading || !announcement?.published || !announcement?.message || dismissed) {
    return null;
  }

  const hasImage = !!announcement.image_url;
  const hasLink = !!announcement.link_url;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full px-4 pt-4 pb-1"
      >
        <div
          className={`relative overflow-hidden rounded-2xl ${
            hasImage ? '' : isDark
              ? 'bg-gradient-to-br from-green-600/20 via-emerald-600/15 to-teal-600/20 border border-green-500/30'
              : 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border border-green-200/60'
          }`}
          style={hasImage ? undefined : {
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Background image with overlay */}
          {hasImage && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${announcement.image_url})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/40" />
            </>
          )}

          {/* Default gradient decoration (no image) */}
          {!hasImage && (
            <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
              <div className={`absolute inset-0 rounded-full blur-3xl ${
                isDark ? 'bg-green-400' : 'bg-green-300'
              }`} />
            </div>
          )}

          {/* Content */}
          <div className="relative z-10 flex items-center gap-4 px-5 py-4">
            {/* Icon */}
            {!hasImage && (
              <div className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ${
                isDark
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-green-500/10 border border-green-500/20'
              }`}>
                <Megaphone className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              </div>
            )}

            {/* Text content */}
            <div className="flex-1 min-w-0">
              {announcement.title && (
                <p className={`text-sm font-bold tracking-tight ${
                  hasImage ? 'text-white' : isDark ? 'text-white' : 'text-green-900'
                }`}>
                  {announcement.title}
                </p>
              )}
              <p className={`text-sm leading-relaxed ${
                announcement.title ? 'mt-0.5' : ''
              } ${
                hasImage ? 'text-white/90' : isDark ? 'text-white/80' : 'text-green-800'
              }`}>
                {announcement.message}
              </p>
            </div>

            {/* CTA + Dismiss */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasLink && (
                <a
                  href={announcement.link_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    hasImage
                      ? 'bg-white text-gray-900 hover:bg-white/90 shadow-lg'
                      : isDark
                        ? 'bg-green-500 text-white hover:bg-green-400 shadow-md shadow-green-500/20'
                        : 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-600/20'
                  }`}
                >
                  {announcement.link_text || 'Learn More'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDismissed(true)}
                className={`h-7 w-7 rounded-lg ${
                  hasImage
                    ? 'text-white/80 hover:text-white hover:bg-white/20'
                    : isDark
                      ? 'text-white/60 hover:text-white hover:bg-white/10'
                      : 'text-green-700/60 hover:text-green-900 hover:bg-green-200/40'
                }`}
                aria-label="Dismiss announcement"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Mobile CTA (below text) */}
          {hasLink && (
            <div className="relative z-10 sm:hidden px-5 pb-4 -mt-1">
              <a
                href={announcement.link_url!}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  hasImage
                    ? 'bg-white text-gray-900 hover:bg-white/90 shadow-lg'
                    : isDark
                      ? 'bg-green-500 text-white hover:bg-green-400 shadow-md shadow-green-500/20'
                      : 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-600/20'
                }`}
              >
                {announcement.link_text || 'Learn More'}
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
