import { cn } from "@/lib/utils";

interface TeamCircleProps {
  teamName: string;
  sport: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

// Helper function to get team initials (first letters of each word)
function getTeamInitials(teamName: string): string {
  const words = teamName.split(' ').filter(word => word.length > 0);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.map(word => word.charAt(0).toUpperCase()).join('').substring(0, 2);
}

// Get team colors based on sport and team name
function getTeamColors(teamName: string, sport: string): { primary: string; secondary: string } {
  // For now, return default colors - in the future this can be expanded with full color mappings
  // similar to what's in EditorsPicks.tsx
  return {
    primary: '#3b82f6', // blue-500
    secondary: '#1e40af', // blue-700
  };
}

export function TeamCircle({ 
  teamName, 
  sport, 
  size = 'md',
  className 
}: TeamCircleProps) {
  const initials = getTeamInitials(teamName);
  const colors = getTeamColors(teamName, sport);
  
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white shadow-md border-2',
        sizeClasses[size],
        className
      )}
      style={{ 
        backgroundColor: colors.primary,
        borderColor: colors.secondary
      }}
      title={teamName}
    >
      {initials}
    </div>
  );
}

