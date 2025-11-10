import { cn } from "@/lib/utils";

interface UserCircleProps {
  userId?: string;
  displayName?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// 26 unique gradients, one for each letter A-Z
const letterGradients: Record<string, string> = {
  A: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  B: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  C: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  D: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  E: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  F: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  G: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  H: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)',
  I: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  J: 'linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)',
  K: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  L: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
  M: 'linear-gradient(135deg, #f77062 0%, #fe5196 100%)',
  N: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  O: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  P: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  Q: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  R: 'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)',
  S: 'linear-gradient(135deg, #c471f5 0%, #fa71cd 100%)',
  T: 'linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%)',
  U: 'linear-gradient(135deg, #feada6 0%, #f5efef 100%)',
  V: 'linear-gradient(135deg, #a1ffce 0%, #faffd1 100%)',
  W: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  X: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  Y: 'linear-gradient(135deg, #ffc3a0 0%, #ffafbd 100%)',
  Z: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
};

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

export function UserCircle({ 
  userId, 
  displayName, 
  email, 
  size = 'md',
  className 
}: UserCircleProps) {
  // Get the first letter from displayName or email
  const name = displayName || email || 'U';
  const firstLetter = name.charAt(0).toUpperCase();
  
  // Get the gradient for this letter, fallback to 'A' gradient if not A-Z
  const gradient = letterGradients[firstLetter] || letterGradients['A'];
  
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white shadow-md',
        sizeClasses[size],
        className
      )}
      style={{ background: gradient }}
      title={displayName || email}
    >
      {firstLetter}
    </div>
  );
}

