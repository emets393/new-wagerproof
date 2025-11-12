import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Sparkles } from 'lucide-react';
import { getTodayInSportsCompletion } from '@/services/aiCompletionService';
import { format } from 'date-fns';

export function TodayInSportsCompletionHeader() {
  const { data: completion, isLoading } = useQuery({
    queryKey: ['today-in-sports-completion'],
    queryFn: getTodayInSportsCompletion,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <Card className="mx-0 mb-6 border-white/20 rounded-none md:rounded-lg bg-gradient-to-br from-green-500/10 via-blue-500/10 to-purple-500/10">
        <div className="px-4 md:px-6 py-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Card>
    );
  }

  if (!completion) {
    return (
      <Card className="mx-0 mb-6 border-white/20 rounded-none md:rounded-lg bg-gradient-to-br from-green-500/10 via-blue-500/10 to-purple-500/10">
        <div className="px-4 md:px-6 py-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <CalendarDays className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Today in Sports
              </h2>
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs font-semibold">
                BETA
              </Badge>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            No briefing available yet. Check back soon!
          </p>
        </div>
      </Card>
    );
  }

  const completionDate = new Date(completion.completion_date);
  const formattedDate = format(completionDate, 'EEEE, MMMM d, yyyy');

  return (
    <Card 
      className="mx-0 mb-6 border-white/20 rounded-none md:rounded-lg relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 50%, rgba(139, 92, 246, 0.1) 100%)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
      }}
    >
      {/* Animated gradient background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: 'linear-gradient(45deg, #10b981 0%, #3b82f6 50%, #8b5cf6 100%)',
          backgroundSize: '200% 200%',
          animation: 'gradient-shift 8s ease infinite',
        }}
      />
      
      <div className="relative z-10 px-4 md:px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20 shrink-0">
              <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white break-words">
                  Today in Sports
                </h2>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs font-semibold">
                  BETA
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
                <CalendarDays className="h-3 w-3 shrink-0" />
                <span className="break-words">{formattedDate}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Completion Text */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
            {completion.completion_text}
          </div>
        </div>

        {/* Footer */}
        {completion.generated_at && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Generated {format(new Date(completion.generated_at), 'h:mm a')} ET
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </Card>
  );
}

