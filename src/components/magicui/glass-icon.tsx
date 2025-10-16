import React from 'react';

export interface GlassIconProps {
  icon: React.ReactElement;
  color: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isHovered?: boolean;
  onClick?: () => void;
}

const gradientMapping: Record<string, string> = {
  blue: 'linear-gradient(hsl(223, 90%, 50%), hsl(208, 90%, 50%))',
  purple: 'linear-gradient(hsl(283, 90%, 50%), hsl(268, 90%, 50%))',
  red: 'linear-gradient(hsl(3, 90%, 50%), hsl(348, 90%, 50%))',
  pink: 'linear-gradient(hsl(330, 90%, 50%), hsl(315, 90%, 50%))',
  indigo: 'linear-gradient(hsl(253, 90%, 50%), hsl(238, 90%, 50%))',
  orange: 'linear-gradient(hsl(43, 90%, 50%), hsl(28, 90%, 50%))',
  green: 'linear-gradient(hsl(123, 90%, 40%), hsl(108, 90%, 40%))'
};

const sizeClasses = {
  sm: 'w-[3.5em] h-[3.5em]',
  md: 'w-[4.5em] h-[4.5em]',
  lg: 'w-[5.5em] h-[5.5em]'
};

const iconSizeClasses = {
  sm: 'w-[1.25em] h-[1.25em]',
  md: 'w-[1.5em] h-[1.5em]',
  lg: 'w-[1.75em] h-[1.75em]'
};

const GlassIcon: React.FC<GlassIconProps> = ({ 
  icon, 
  color, 
  label, 
  className = '',
  size = 'md',
  isHovered = false,
  onClick
}) => {
  const getBackgroundStyle = (color: string): React.CSSProperties => {
    if (gradientMapping[color]) {
      return { background: gradientMapping[color] };
    }
    return { background: color };
  };

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`relative bg-transparent outline-none ${sizeClasses[size]} [perspective:24em] [transform-style:preserve-3d] [-webkit-tap-highlight-color:transparent] group cursor-pointer ${className}`}
    >
      <span
        className="absolute top-0 left-0 w-full h-full rounded-[1.25em] block transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.83,0,0.17,1)] origin-[100%_100%] rotate-[15deg] group-hover:[transform:rotate(25deg)_translate3d(-0.5em,-0.5em,0.5em)]"
        style={{
          ...getBackgroundStyle(color),
          boxShadow: '0.5em -0.5em 0.75em hsla(223, 10%, 10%, 0.15)'
        }}
      ></span>

      <span
        className="absolute top-0 left-0 w-full h-full rounded-[1.25em] bg-gray-100/60 dark:bg-[hsla(0,0%,100%,0.15)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.83,0,0.17,1)] origin-[80%_50%] flex backdrop-blur-[0.75em] [-webkit-backdrop-filter:blur(0.75em)] transform group-hover:[transform:translateZ(2em)]"
        style={{
          boxShadow: '0 0 0 0.1em hsla(0, 0%, 100%, 0.3) inset'
        }}
      >
        <span className={`m-auto ${iconSizeClasses[size]} flex items-center justify-center text-gray-800 dark:text-white`} aria-hidden="true">
          {icon}
        </span>
      </span>
    </button>
  );
};

export default GlassIcon;