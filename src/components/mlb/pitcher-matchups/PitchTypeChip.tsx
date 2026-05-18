import React from 'react';
import { cn } from '@/lib/utils';
import { abbrevPitchLabel, pitchFamily, pitchFamilyClass } from '@/utils/mlbPitcherMatchups';

interface PitchTypeChipProps {
  pitchType: string;
  label: string;
  className?: string;
}

export function PitchTypeChip({ pitchType, label, className }: PitchTypeChipProps) {
  const short = abbrevPitchLabel(pitchType, label);
  const full = label.trim() || pitchType;

  return (
    <span
      title={full !== short ? full : undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md border px-1 py-0.5 text-[10px] sm:text-[11px] font-semibold leading-none',
        'w-[4.25rem] sm:w-[4.5rem] text-center tabular-nums',
        pitchFamilyClass(pitchFamily(pitchType)),
        className,
      )}
    >
      {short}
    </span>
  );
}
