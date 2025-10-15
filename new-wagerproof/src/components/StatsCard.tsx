
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  gradient: string;
  description?: string;
}

const StatsCard = ({ title, value, icon: Icon, gradient, description }: StatsCardProps) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className={`bg-gradient-to-r ${gradient} p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">{title}</p>
              <p className="text-3xl font-bold mt-1">{value}</p>
              {description && (
                <p className="text-white/70 text-xs mt-1">{description}</p>
              )}
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCard;
