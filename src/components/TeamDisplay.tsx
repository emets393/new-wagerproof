
interface TeamDisplayProps {
  team: string;
  isHome: boolean;
}

const TeamDisplay = ({ team, isHome }: TeamDisplayProps) => {
  // Function to get team logo placeholder based on team name
  const getTeamLogo = (teamName: string) => {
    // For now, using a placeholder with team initials
    const initials = teamName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 3);
    
    return initials;
  };

  const getTeamColors = (teamName: string) => {
    // Basic color scheme based on team name
    const colorMap: { [key: string]: string } = {
      'Angels': 'bg-red-500',
      'Astros': 'bg-orange-500',
      'Athletics': 'bg-green-500',
      'Blue Jays': 'bg-blue-500',
      'Braves': 'bg-red-600',
      'Brewers': 'bg-blue-600',
      'Cardinals': 'bg-red-700',
      'Cubs': 'bg-blue-700',
      'Diamondbacks': 'bg-purple-500',
      'Dodgers': 'bg-blue-800',
      'Giants': 'bg-orange-600',
      'Guardians': 'bg-red-800',
      'Mariners': 'bg-teal-500',
      'Marlins': 'bg-cyan-500',
      'Mets': 'bg-blue-500',
      'Nationals': 'bg-red-500',
      'Orioles': 'bg-orange-500',
      'Padres': 'bg-yellow-600',
      'Phillies': 'bg-red-600',
      'Pirates': 'bg-yellow-500',
      'Rangers': 'bg-blue-600',
      'Rays': 'bg-blue-400',
      'Red Sox': 'bg-red-700',
      'Reds': 'bg-red-600',
      'Rockies': 'bg-purple-600',
      'Royals': 'bg-blue-500',
      'Tigers': 'bg-orange-600',
      'Twins': 'bg-red-500',
      'White Sox': 'bg-gray-800',
      'Yankees': 'bg-gray-700',
    };

    return colorMap[teamName] || 'bg-primary';
  };

  return (
    <div className={`flex flex-col items-center space-y-2 ${isHome ? 'text-right' : 'text-left'}`}>
      <div 
        className={`w-12 h-12 rounded-full ${getTeamColors(team)} flex items-center justify-center text-white font-bold text-sm`}
      >
        {getTeamLogo(team)}
      </div>
      <div className="text-sm font-semibold text-center min-h-[2.5rem] flex items-center">
        {team}
      </div>
    </div>
  );
};

export default TeamDisplay;
