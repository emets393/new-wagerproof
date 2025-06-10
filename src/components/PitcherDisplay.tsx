
interface PitcherDisplayProps {
  pitcher: string;
  era: number;
  whip: number;
  label: string;
}

const PitcherDisplay = ({ pitcher, era, whip, label }: PitcherDisplayProps) => {
  const formatStat = (stat: number) => {
    return stat ? stat.toFixed(2) : 'N/A';
  };

  return (
    <div className="text-center space-y-2">
      <div className="text-xs text-muted-foreground font-medium">
        {label}
      </div>
      
      <div className="font-semibold text-sm leading-tight min-h-[2.5rem] flex items-center justify-center">
        {pitcher || 'TBD'}
      </div>
      
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">ERA:</span>
          <span className="font-medium">{formatStat(era)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">WHIP:</span>
          <span className="font-medium">{formatStat(whip)}</span>
        </div>
      </div>
    </div>
  );
};

export default PitcherDisplay;
