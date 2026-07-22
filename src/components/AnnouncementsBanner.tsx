import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Megaphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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
        className="w-full"
      >
        <div className="group relative isolate overflow-hidden border-y border-border/60 bg-background/75 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
          {/* Hero-style aura: layered color fields rather than a flat alert fill. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_180%_at_4%_0%,rgba(16,185,129,0.22),transparent_68%),radial-gradient(55%_160%_at_92%_100%,rgba(59,130,246,0.16),transparent_72%)] dark:bg-[radial-gradient(70%_180%_at_4%_0%,rgba(16,185,129,0.18),transparent_68%),radial-gradient(55%_160%_at_92%_100%,rgba(99,102,241,0.16),transparent_72%)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/70 to-transparent" />

          {hasImage && (
            <>
              <div
                className="absolute inset-y-0 right-0 w-2/5 bg-cover bg-center opacity-20 mix-blend-luminosity sm:opacity-30"
                style={{ backgroundImage: `url(${announcement.image_url})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/75 to-background/30" />
            </>
          )}

          <div className="relative z-10 flex min-h-[62px] items-center gap-3 px-4 py-2.5 sm:px-5">
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 shadow-[inset_0_1px_rgba(255,255,255,0.35)] dark:text-emerald-400 sm:flex">
              <Megaphone className="h-[17px] w-[17px]" />
            </div>

            <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-2.5">
              {announcement.title && (
                <p className="shrink-0 text-[13px] font-extrabold tracking-tight text-foreground">
                  {announcement.title}
                </p>
              )}
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:line-clamp-1 sm:text-[13px]">
                {announcement.message}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {hasLink && (
                <a
                  href={announcement.link_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-300 sm:inline-flex"
                >
                  {announcement.link_text || 'Learn More'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDismissed(true)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                aria-label="Dismiss announcement"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {hasLink && (
            <div className="relative z-10 border-t border-border/40 px-4 py-2 sm:hidden">
              <a
                href={announcement.link_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300"
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
