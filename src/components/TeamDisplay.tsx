
interface TeamDisplayProps {
  team: string;
  isHome: boolean;
}

const TeamDisplay = ({ team, isHome }: TeamDisplayProps) => {
  // Function to get team logo URL based on team name
  const getTeamLogo = (teamName: string) => {
    const logoMap: { [key: string]: string } = {
      'Arizona': 'https://loodibee.com/wp-content/uploads/mlb-arizona-diamondbacks-logo-300x300.png',
      'Atlanta': 'https://loodibee.com/wp-content/uploads/mlb-atlanta-braves-logo-300x300.png',
      'Baltimore': 'https://loodibee.com/wp-content/uploads/mlb-baltimore-orioles-logo-300x300.png',
      'Boston': 'https://loodibee.com/wp-content/uploads/mlb-boston-red-sox-logo-300x300.png',
      'Cubs': 'https://loodibee.com/wp-content/uploads/mlb-chicago-cubs-logo-300x300.png',
      'White Sox': 'https://loodibee.com/wp-content/uploads/mlb-chicago-white-sox-logo-300x300.png',
      'Cincinnati': 'https://loodibee.com/wp-content/uploads/mlb-cincinnati-reds-logo-300x300.png',
      'Cleveland': 'https://loodibee.com/wp-content/uploads/mlb-cleveland-guardians-logo-300x300.png',
      'Colorado': 'https://loodibee.com/wp-content/uploads/mlb-colorado-rockies-logo-300x300.png',
      'Detroit': 'https://loodibee.com/wp-content/uploads/mlb-detroit-tigers-logo-300x300.png',
      'Houston': 'https://loodibee.com/wp-content/uploads/mlb-houston-astros-logo-300x300.png',
      'Kansas City': 'https://loodibee.com/wp-content/uploads/mlb-kansas-city-royals-logo-300x300.png',
      'Angels': 'https://loodibee.com/wp-content/uploads/mlb-los-angeles-angels-logo-300x300.png',
      'Dodgers': 'https://loodibee.com/wp-content/uploads/mlb-los-angeles-dodgers-logo-300x300.png',
      'Miami': 'https://loodibee.com/wp-content/uploads/mlb-miami-marlins-logo-300×300.png',
      'Milwaukee': 'https://loodibee.com/wp-content/uploads/mlb-milwaukee-brewers-logo-300x300.png',
      'Minnesota': 'https://loodibee.com/wp-content/uploads/mlb-minnesota-twins-logo-300x300.png',
      'Mets': 'https://loodibee.com/wp-content/uploads/mlb-new-york-mets-logo-300x300.png',
      'Yankees': 'https://loodibee.com/wp-content/uploads/mlb-new-york-yankees-logo-300x300.png',
      'Athletics': 'https://loodibee.com/wp-content/uploads/mlb-oakland-athletics-logo-300x300.png',
      'Philadelphia': 'https://loodibee.com/wp-content/uploads/mlb-philadelphia-phillies-logo-300x300.png',
      'Pittsburgh': 'https://loodibee.com/wp-content/uploads/mlb-pittsburgh-pirates-logo-300x300.png',
      'San Diego': 'https://loodibee.com/wp-content/uploads/mlb-san-diego-padres-logo-300x300.png',
      'San Francisco': 'https://loodibee.com/wp-content/uploads/mlb-san-francisco-giants-logo-300x300.png',
      'Seattle': 'https://loodibee.com/wp-content/uploads/mlb-seattle-mariners-logo-300x300.png',
      'ST Louis': 'https://loodibee.com/wp-content/uploads/mlb-st-louis-cardinals-logo-300x300.png',
      'Tampa Bay': 'https://loodibee.com/wp-content/uploads/mlb-tampa-bay-rays-logo-300x300.png',
      'Texas': 'https://loodibee.com/wp-content/uploads/mlb-texas-rangers-logo-300x300.png',
      'Toronto': 'https://loodibee.com/wp-content/uploads/mlb-toronto-blue-jays-logo-300x300.png',
      'Washington': 'https://loodibee.com/wp-content/uploads/mlb-washington-nationals-logo-300x300.png',
    };

    return logoMap[teamName];
  };

  // Fallback function for team initials if logo fails to load
  const getTeamInitials = (teamName: string) => {
    return teamName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 3);
  };

  const logoUrl = getTeamLogo(team);

  return (
    <div className={`flex flex-col items-center space-y-2 ${isHome ? 'text-right' : 'text-left'}`}>
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt={`${team} logo`} 
            className="w-full h-full object-contain"
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = `<span class="text-xs font-bold text-muted-foreground">${getTeamInitials(team)}</span>`;
            }}
          />
        ) : (
          <span className="text-xs font-bold text-muted-foreground">
            {getTeamInitials(team)}
          </span>
        )}
      </div>
      <div className="text-sm font-semibold text-center min-h-[2.5rem] flex items-center">
        {team}
      </div>
    </div>
  );
};

export default TeamDisplay;
