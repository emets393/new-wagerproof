import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Sparkles } from 'lucide-react';
import { getTodayInSportsCompletion } from '@/services/aiCompletionService';
import { format } from 'date-fns';
import debug from '@/utils/debug';
import { renderTextWithLinks } from '@/utils/markdownLinks';

export function TodayInSportsCompletionHeader() {
  const { data: completion, isLoading, error } = useQuery({
    queryKey: ['today-in-sports-completion'],
    queryFn: async () => {
      debug.log('TodayInSportsCompletionHeader: Fetching completion...');
      const result = await getTodayInSportsCompletion();
      debug.log('TodayInSportsCompletionHeader: Fetch result:', {
        hasCompletion: !!result,
        completionDate: result?.completion_date,
        published: result?.published,
        completionId: result?.id,
      });
      return result;
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Log errors for debugging
  if (error) {
    debug.error('TodayInSportsCompletionHeader: Query error:', error);
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!completion) {
    return (
      <div className="p-4 md:p-6">
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
    );
  }

  // Parse completion_date (YYYY-MM-DD) as a local date to avoid timezone issues
  // When you do new Date("2025-11-12"), it's interpreted as UTC midnight which can show wrong day
  // Instead, parse it manually and create a local date
  const parseLocalDate = (dateString: string): Date => {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // months are 0-indexed
      const day = parseInt(parts[2], 10);
      // Create date in local timezone (no UTC conversion)
      return new Date(year, month, day);
    }
    return new Date(dateString);
  };
  
  const completionDate = parseLocalDate(completion.completion_date);
  const formattedDate = format(completionDate, 'EEEE, MMMM d, yyyy');

  return (
    <div className="p-4 md:p-6">
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
          {renderTextWithLinks(completion.completion_text)}
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
  );
}

