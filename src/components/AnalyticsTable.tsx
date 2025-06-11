
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
  winPct: number;
  runlinePct: number;
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
            <TableHead className="text-center font-semibold">Win %</TableHead>
            <TableHead className="text-center font-semibold">Runline %</TableHead>
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
                  <Badge variant="secondary" className={getPercentageColor(team.winPct)}>
                    {formatPercentage(team.winPct)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className={getPercentageColor(team.runlinePct)}>
                    {formatPercentage(team.runlinePct)}
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
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
