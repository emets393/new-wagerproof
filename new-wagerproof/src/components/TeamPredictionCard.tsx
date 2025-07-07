
import ConfidenceChart from './ConfidenceChart';

interface TeamPredictionCardProps {
  title: string;
  predictedTeam: string;
  confidence: number;
  homeTeam: string;
  awayTeam: string;
}

const TeamPredictionCard = ({ title, predictedTeam, confidence, homeTeam, awayTeam }: TeamPredictionCardProps) => {
  // Function to get team logo URL based on team name
  const getTeamLogo = (teamName: string) => {
    const espnLogoMap: { [key: string]: string } = {
      'Arizona': 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png',
      'Atlanta': 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png',
      'Baltimore': 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png',
      'Boston': 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png',
      'Cubs': 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png',
      'White Sox': 'https://a.espncdn.com/i/teamlogos/mlb/500/cws.png',
      'Cincinnati': 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png',
      'Cleveland': 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png',
      'Colorado': 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png',
      'Detroit': 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png',
      'Houston': 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png',
      'Kansas City': 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png',
      'Angels': 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png',
      'Dodgers': 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png',
      'Miami': 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png',
      'Milwaukee': 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png',
      'Minnesota': 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png',
      'Mets': 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png',
      'Yankees': 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
      'Athletics': 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png',
      'Philadelphia': 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png',
      'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png',
      'San Diego': 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png',
      'San Francisco': 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png',
      'Seattle': 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png',
      'ST Louis': 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png',
      'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png',
      'Texas': 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png',
      'Toronto': 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png',
      'Washington': 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png',
    };

    return espnLogoMap[teamName];
  };

  // Get team colors for the chart
  const getTeamColors = (teamName: string): string[] => {
    const teamColorMap: { [key: string]: string[] } = {
      'Arizona': ['#A71930', '#E8D4CD'],
      'Atlanta': ['#CE1141', '#13274F'],
      'Baltimore': ['#DF4601', '#000000'],
      'Boston': ['#BD3039', '#0C2340'],
      'Cubs': ['#0E3386', '#CC3433'],
      'White Sox': ['#27251F', '#C4CED4'],
      'Cincinnati': ['#C6011F', '#000000'],
      'Cleveland': ['#E31937', '#0C2340'],
      'Colorado': ['#33006F', '#C4CED4'],
      'Detroit': ['#0C2340', '#FA4616'],
      'Houston': ['#EB6E1F', '#002D62'],
      'Kansas City': ['#004687', '#C09A5B'],
      'Angels': ['#BA0021', '#003263'],
      'Dodgers': ['#005A9C', '#FFFFFF'],
      'Miami': ['#00A3E0', '#EF3340'],
      'Milwaukee': ['#12284B', '#FFC52F'],
      'Minnesota': ['#002B5C', '#D31145'],
      'Mets': ['#002D72', '#FF5910'],
      'Yankees': ['#132448', '#C4CED4'],
      'Athletics': ['#003831', '#EFB21E'],
      'Philadelphia': ['#E81828', '#002D72'],
      'Pittsburgh': ['#FDB827', '#27251F'],
      'San Diego': ['#2F241D', '#FFC425'],
      'San Francisco': ['#FD5A1E', '#27251F'],
      'Seattle': ['#0C2C56', '#005C5C'],
      'ST Louis': ['#C41E3A', '#FEDB00'],
      'Tampa Bay': ['#092C5C', '#8FBCE6'],
      'Texas': ['#003278', '#C0111F'],
      'Toronto': ['#134A8E', '#1D2D5C'],
      'Washington': ['#AB0003', '#14225A'],
    };

    return teamColorMap[teamName] || ['#10b981', '#e5e7eb'];
  };

  const logoUrl = getTeamLogo(predictedTeam);
  const teamColors = getTeamColors(predictedTeam);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
    target.parentElement!.innerHTML = `<span class="text-sm font-bold text-muted-foreground">${predictedTeam.slice(0, 3).toUpperCase()}</span>`;
  };

  return (
    <div className="bg-gradient-to-br from-card to-card/30 border border-border/50 rounded-xl p-6 shadow-lg backdrop-blur-sm">
      <h4 className="font-bold text-lg text-foreground mb-4 text-center">{title}</h4>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={`${predictedTeam} logo`} 
                className="w-full h-full object-contain"
                onError={handleImageError}
              />
            ) : (
              <span className="text-sm font-bold text-muted-foreground">
                {predictedTeam.slice(0, 3).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div className="font-semibold text-foreground">{predictedTeam}</div>
            <div className="text-sm text-muted-foreground">Predicted Winner</div>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs font-medium text-muted-foreground mb-1">Confidence %</div>
          <ConfidenceChart confidence={confidence} teamColors={teamColors} />
        </div>
      </div>
    </div>
  );
};

export default TeamPredictionCard;
