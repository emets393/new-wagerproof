import { cn } from "@/lib/utils";
import { UserCircle } from "./UserCircle";
import { TailingUser } from "@/types/game-tails";

interface TailingAvatarListProps {
  users: TailingUser[];
  size?: "sm" | "md";
  className?: string;
  maxVisible?: number;
}

export function TailingAvatarList({ 
  users, 
  size = "sm", 
  className,
  maxVisible = 5 
}: TailingAvatarListProps) {
  if (!users || users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;
  
  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
  };

  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      <div className="flex items-center -space-x-2 shrink-0">
        {visibleUsers.map((user, idx) => (
          <div
            key={user.user_id}
            className={cn(
              "rounded-full border-2 border-white dark:border-gray-800 transition-transform hover:scale-110 hover:z-10 shrink-0",
              idx > 0 && "ml-[-8px]"
            )}
            style={{ zIndex: visibleUsers.length - idx }}
            title={user.display_name || user.email}
          >
            <UserCircle
              userId={user.user_id}
              displayName={user.display_name}
              email={user.email}
              size={size}
            />
          </div>
        ))}
        
        {remainingCount > 0 && (
          <div
            className={cn(
              "rounded-full border-2 border-white dark:border-gray-800 bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0",
              sizeClasses[size]
            )}
            style={{ zIndex: 0 }}
            title={`${remainingCount} more`}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    </div>
  );
}

