import React from 'react';

export interface GlassIconProps {
  icon: React.ReactElement;
  color: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  isHovered?: boolean;
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
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20'
};

const iconSizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10'
};

const GlassIcon: React.FC<GlassIconProps> = ({ 
  icon, 
  color, 
  label, 
  className = '',
  size = 'md',
  isHovered = false
}) => {
  const getBackgroundStyle = (color: string): React.CSSProperties => {
    if (gradientMapping[color]) {
      return { background: gradientMapping[color] };
    }
    return { background: color };
  };

  return (
    <div
      aria-label={label}
      className={`relative bg-transparent outline-none ${sizeClasses[size]} [perspective:24em] [transform-style:preserve-3d] [-webkit-tap-highlight-color:transparent] ${className}`}
    >
      <span
        className={`absolute top-0 left-0 w-full h-full rounded-[1.25em] block transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.83,0,0.17,1)] origin-[100%_100%] ${
          isHovered ? '[transform:rotate(25deg)_translate3d(-0.5em,-0.5em,0.5em)]' : 'rotate-[15deg]'
        }`}
        style={{
          ...getBackgroundStyle(color),
          boxShadow: '0.5em -0.5em 0.75em hsla(223, 10%, 10%, 0.15)'
        }}
      ></span>

      <span
        className={`absolute top-0 left-0 w-full h-full rounded-[1.25em] bg-[hsla(0,0%,100%,0.15)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.83,0,0.17,1)] origin-[80%_50%] flex backdrop-blur-[0.75em] [-webkit-backdrop-filter:blur(0.75em)] ${
          isHovered ? '[transform:translateZ(2em)]' : 'transform'
        }`}
        style={{
          boxShadow: '0 0 0 0.1em hsla(0, 0%, 100%, 0.3) inset'
        }}
      >
        <span className={`m-auto ${iconSizeClasses[size]} flex items-center justify-center text-white`} aria-hidden="true">
          {React.cloneElement(icon, { className: `${iconSizeClasses[size]} text-white` })}
        </span>
      </span>
    </div>
  );
};

export default GlassIcon;