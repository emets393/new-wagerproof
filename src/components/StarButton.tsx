import { Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorPick } from '@/hooks/useEditorPick';
import { cn } from '@/lib/utils';

interface StarButtonProps {
  gameId: string;
  gameType: 'nfl' | 'cfb';
  className?: string;
}

export function StarButton({ gameId, gameType, className }: StarButtonProps) {
  const { isStarred, isLoading, toggleStar, showStar } = useEditorPick(gameId, gameType);

  if (!showStar) return null;

  return (
    <Button
      onClick={(e) => {
        e.stopPropagation();
        toggleStar();
      }}
      disabled={isLoading}
      variant="ghost"
      size="icon"
      className={cn(
        "absolute top-2 right-2 z-10 h-8 w-8 rounded-full",
        "bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm",
        "hover:bg-white dark:hover:bg-gray-800",
        "border border-gray-200 dark:border-gray-700",
        "shadow-md hover:shadow-lg transition-all",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
      ) : (
        <Star
          className={cn(
            "h-4 w-4 transition-all",
            isStarred
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-400 hover:text-yellow-400"
          )}
        />
      )}
    </Button>
  );
}

