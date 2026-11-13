import type { ReactNode } from 'react';

// Three overlapping marker passes, roughened with a displacement filter so the edges
// look dragged rather than drawn. Stretched to the text box via background-size.
const MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 100" preserveAspectRatio="none"><defs><filter id="r" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.5" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter></defs><g filter="url(#r)" fill="none" stroke="#16a34a" stroke-linecap="round"><path d="M22 34 C150 26 420 30 582 28" stroke-width="34"/><path d="M14 54 C190 48 400 58 588 50" stroke-width="36" stroke-opacity="0.94"/><path d="M26 72 C200 78 430 68 574 74" stroke-width="30" stroke-opacity="0.9"/></g></svg>`;

const MARKER_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(MARKER_SVG)}")`;

/**
 * White italic text over a green dry-erase marker swipe.
 * It's a CSS background with box-decoration-break: clone (not an absolutely positioned
 * SVG) so that when the phrase wraps, each line gets its own full swipe.
 */
export default function MarkerHighlight({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline bg-no-repeat px-[0.28em] py-[0.04em] italic text-white [-webkit-box-decoration-break:clone] [box-decoration-break:clone] ${className}`}
      style={{ backgroundImage: MARKER_URL, backgroundSize: '100% 100%' }}
    >
      {children}
    </span>
  );
}
