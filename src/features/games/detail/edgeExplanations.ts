/**
 * Model-vs-Vegas edge helpers, moved out of GameDetailsModal so the per-sport
 * detail sections share one copy. Semantics unchanged.
 */

export const roundToHalf = (value: number): number => Math.round(value * 2) / 2;

export const formatHalfNoSign = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
  return roundToHalf(Number(value)).toString();
};

export const formatEdge = (edge: number): string => roundToHalf(Math.abs(edge)).toString();

export const getEdgeInfo = (
  homeSpreadDiff: number | null,
  awayTeam: string,
  homeTeam: string
) => {
  if (homeSpreadDiff === null || isNaN(homeSpreadDiff)) return null;

  const isHomeEdge = homeSpreadDiff > 0;
  const teamName = isHomeEdge ? homeTeam : awayTeam;
  const edgeValue = Math.abs(homeSpreadDiff);

  return {
    teamName,
    edgeValue: roundToHalf(edgeValue),
    isHomeEdge,
    displayEdge: formatEdge(homeSpreadDiff),
  };
};

export const getEdgeExplanation = (
  edge: number,
  team: string,
  type: 'spread' | 'ou',
  direction?: 'over' | 'under'
): string => {
  const absEdge = Math.abs(edge);

  if (type === 'spread') {
    if (absEdge >= 7) {
      return `Our model spread differs from the Vegas line by ${absEdge.toFixed(1)} points, favoring ${team}. This large discrepancy suggests Vegas may have significantly mispriced this matchup.`;
    } else if (absEdge >= 3) {
      return `Our model's ${absEdge.toFixed(1)}-point difference from the Vegas spread favors ${team}. This moderate edge shows our analytics see the game differently than the market.`;
    } else {
      return `Our model differs from Vegas by ${absEdge.toFixed(1)} points on ${team}. This small edge indicates our projection is fairly close to the market's assessment.`;
    }
  } else {
    const dir = direction || 'over';
    if (absEdge >= 7) {
      return `Our model's projected total differs from the Vegas line by ${absEdge.toFixed(1)} points, leaning ${dir}. This significant gap suggests Vegas has mispriced this game's scoring potential.`;
    } else if (absEdge >= 3) {
      return `Our model projects a total that's ${absEdge.toFixed(1)} points different from Vegas, favoring the ${dir}. This moderate discrepancy shows our scoring projection doesn't align with the market.`;
    } else {
      return `Our model's total is ${absEdge.toFixed(1)} points from the Vegas line, slightly favoring the ${dir}. This minimal difference means our projection closely matches the market's assessment.`;
    }
  }
};
