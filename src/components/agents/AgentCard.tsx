import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import { Activity, ShieldCheck } from 'lucide-react';
import { AgentWithPerformance, formatNetUnits, formatRecord, formatStreak, Sport } from '@/types/agent';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface AgentCardProps {
  agent: AgentWithPerformance;
  onOpen: (agentId: string) => void;
  onToggleActive?: (agentId: string, checked: boolean) => void;
  isTogglePending?: boolean;
}

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  ncaab: 'NCAAB',
};

function parseAvatarColor(value: string): { isGradient: boolean; colors: string[] } {
  if (value.startsWith('gradient:')) {
    return { isGradient: true, colors: value.replace('gradient:', '').split(',') };
  }
  return { isGradient: false, colors: [value] };
}

export function AgentCard({ agent, onOpen, onToggleActive, isTogglePending = false }: AgentCardProps) {
  const [pulseAnimation, setPulseAnimation] = useState<object | null>(null);
  const perf = agent.performance;
  const record = formatRecord(perf);
  const netUnits = formatNetUnits(perf?.net_units || 0);
  const streak = formatStreak(perf?.current_streak || 0);
  const unitsPositive = (perf?.net_units || 0) >= 0;
  const streakPositive = (perf?.current_streak || 0) > 0;
  const streakNegative = (perf?.current_streak || 0) < 0;

  const colorInfo = parseAvatarColor(agent.avatar_color || '#6366f1');
  const primaryColor = colorInfo.colors[0] || '#6366f1';
  const isAutopilotOn = agent.is_active && agent.auto_generate;

  useEffect(() => {
    let alive = true;
    fetch('/pulselottie.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && data) setPulseAnimation(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleOpen = () => onOpen(agent.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2 }}
      className="w-full text-left"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
    >
      <Card className="relative overflow-hidden border-border/70 bg-card/95 shadow-sm hover:shadow-md transition-shadow">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: colorInfo.isGradient
              ? `radial-gradient(90% 70% at 12% 12%, ${colorInfo.colors[0]}26 0%, transparent 60%), radial-gradient(90% 70% at 88% 88%, ${colorInfo.colors[1] || colorInfo.colors[0]}22 0%, transparent 65%)`
              : `radial-gradient(90% 70% at 15% 15%, ${primaryColor}24 0%, transparent 65%)`,
            filter: 'blur(18px)',
          }}
        />
        <div
          className="relative h-1 w-full"
          style={{
            background: colorInfo.isGradient
              ? `linear-gradient(90deg, ${colorInfo.colors.join(',')})`
              : primaryColor,
          }}
        />
        <CardContent className="relative p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="h-12 w-12 rounded-xl grid place-items-center text-2xl"
              style={{ background: `${primaryColor}22` }}
            >
              {agent.avatar_emoji || '🤖'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-base truncate">{agent.name}</p>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {agent.preferred_sports.map((sport) => (
                  <Badge key={sport} variant="outline" className="text-[10px] h-5 px-2">
                    {SPORT_LABELS[sport]}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                {agent.is_public ? 'Public' : 'Private'}
              </div>
            </div>

            <div
              className="ml-1 flex flex-col items-end gap-1.5 self-start"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Switch
                checked={agent.is_active}
                disabled={isTogglePending}
                onCheckedChange={(checked) => onToggleActive?.(agent.id, checked)}
              />
              <div className="min-h-10 flex items-center gap-1.5">
                {isAutopilotOn ? (
                  <>
                    <span className="text-[11px] font-semibold text-emerald-500 whitespace-nowrap">Autopilot Active</span>
                    {pulseAnimation ? (
                      <span className="h-10 w-10">
                        <Lottie animationData={pulseAnimation} loop autoplay style={{ width: 40, height: 40 }} />
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                    {agent.auto_generate ? 'Autopilot Ready' : 'Manual Mode'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Record" value={record} />
            <Stat label="Net Units" value={netUnits} valueClass={unitsPositive ? 'text-emerald-500' : 'text-red-500'} />
            <Stat
              label="Streak"
              value={streak}
              valueClass={streakPositive ? 'text-emerald-500' : streakNegative ? 'text-red-500' : ''}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/60">
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {perf?.total_picks || 0} total picks
            </span>
            <span>Open details</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className={`font-semibold ${valueClass || ''}`}>{value}</p>
    </div>
  );
}
