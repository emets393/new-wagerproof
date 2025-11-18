import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInViewAnimation } from "@/hooks/useInViewAnimation";
import { Marquee } from "@/components/magicui/marquee";
import { cn } from "@/lib/utils";
import { Trophy, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const WinCard = ({
  image_url,
  caption,
  created_at,
}: {
  image_url: string;
  caption: string | null;
  created_at: string;
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className={cn(
            "relative h-64 w-80 cursor-pointer overflow-hidden rounded-xl border mx-4 group transition-all hover:scale-105",
            // light styles
            "border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]",
            // dark styles
            "dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]",
          )}
        >
          <img 
            src={image_url} 
            alt="Big Win" 
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
            {caption && (
              <p className="text-white text-sm line-clamp-2 italic">"{caption}"</p>
            )}
            <p className="text-white/60 text-xs mt-1">
              {new Date(created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none">
        <div className="relative">
          <img 
            src={image_url} 
            alt="Big Win Full" 
            className="w-full h-auto max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
          {caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-4 text-white rounded-b-lg">
              <p className="text-lg italic text-center">"{caption}"</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const UserWinsSection = () => {
  const [sectionRef, inView] = useInViewAnimation<HTMLDivElement>();

  const { data: wins, isLoading } = useQuery({
    queryKey: ['featured-user-wins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_wins' as any)
        .select('*')
        .eq('is_featured', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as any[];
    }
  });

  return (
    <section
      ref={sectionRef}
      className={`py-14 bg-transparent transition-opacity duration-700 ${inView ? "opacity-100 animate-fade-in" : "opacity-0"}`}
    >
      {/* Header Content - Centered */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-3xl mx-auto mb-12 transition-all duration-700 ${inView ? "animate-fade-in" : "opacity-0 translate-y-10"}`}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
              Wins from Our Users
            </h2>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            See how our users are winning big with WagerProof insights
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : wins && wins.length > 0 ? (
        <div className="relative w-screen -ml-[50vw] left-[50%] overflow-hidden">
          <div className="flex w-full flex-col items-center justify-center overflow-hidden">
            <Marquee pauseOnHover className="[--duration:40s]">
              {wins.map((win) => (
                <WinCard key={win.id} {...win} />
              ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/12 bg-gradient-to-r from-gray-100 dark:from-gray-950"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/12 bg-gradient-to-l from-gray-100 dark:from-gray-950"></div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No featured wins yet. Check back soon!</p>
        </div>
      )}
    </section>
  );
};

export default UserWinsSection;

