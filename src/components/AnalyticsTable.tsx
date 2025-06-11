
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface TeamData {
  team: string;
  games: number;
  homeWinPct: number;
  awayWinPct: number;
  homeRLPct: number;
  awayRLPct: number;
  overPct: number;
}

interface AnalyticsTableProps {
  data: TeamData[];
}

const AnalyticsTable = ({ data }: AnalyticsTableProps) => {
  const getPercentageColor = (percentage: number) => {
    if (percentage >= 60) return "bg-emerald-100 text-emerald-800";
    if (percentage >= 50) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-semibold">Team</TableHead>
            <TableHead className="text-center font-semibold">Games</TableHead>
            <TableHead className="text-center font-semibold">Home Win %</TableHead>
            <TableHead className="text-center font-semibold">Away Win %</TableHead>
            <TableHead className="text-center font-semibold">Home RL %</TableHead>
            <TableHead className="text-center font-semibold">Away RL %</TableHead>
            <TableHead className="text-center font-semibold">Over %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length > 0 ? (
            data.map((team) => (
              <TableRow key={team.team}>
                <TableCell className="font-medium">{team.team}</TableCell>
                <TableCell className="text-center">{team.games}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className={getPercentageColor(team.homeWinPct)}>
                    {formatPercentage(team.homeWinPct)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className={getPercentageColor(team.awayWinPct)}>
                    {formatPercentage(team.awayWinPct)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className={getPercentageColor(team.homeRLPct)}>
                    {formatPercentage(team.homeRLPct)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className={getPercentageColor(team.awayRLPct)}>
                    {formatPercentage(team.awayRLPct)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className={getPercentageColor(team.overPct)}>
                    {formatPercentage(team.overPct)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No data available for the selected filters
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AnalyticsTable;
