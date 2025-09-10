import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

interface NFLTeamSelectorProps {
  label: string;
  selectedTeams: string[];
  onTeamsChange: (teams: string[]) => void;
  className?: string;
}

interface NFLTeam {
  city_and_name: string;
  team_name: string;
}

export default function NFLTeamSelector({ label, selectedTeams, onTeamsChange, className }: NFLTeamSelectorProps) {
  const [teams, setTeams] = useState<NFLTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data, error } = await collegeFootballSupabase
          .from('nfl_team_mapping')
          .select('city_and_name, team_name')
          .order('team_name');
        
        if (error) {
          console.error('Error fetching NFL teams:', error);
          return;
        }
        
        setTeams(data || []);
      } catch (error) {
        console.error('Error in fetchTeams:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const handleTeamToggle = (teamName: string) => {
    const newSelectedTeams = selectedTeams.includes(teamName)
      ? selectedTeams.filter(team => team !== teamName)
      : [...selectedTeams, teamName];
    
    onTeamsChange(newSelectedTeams);
  };

  const handleSelectAll = () => {
    if (selectedTeams.length === teams.length) {
      onTeamsChange([]);
    } else {
      onTeamsChange(teams.map(team => team.team_name));
    }
  };

  const getDisplayText = () => {
    if (selectedTeams.length === 0) {
      return "All Teams";
    } else if (selectedTeams.length === teams.length) {
      return "All Teams";
    } else if (selectedTeams.length === 1) {
      const team = teams.find(t => t.team_name === selectedTeams[0]);
      return team ? team.city_and_name : selectedTeams[0];
    } else {
      return `${selectedTeams.length} Teams`;
    }
  };

  if (isLoading) {
    return (
      <div className={className}>
        <Label className="text-sm font-medium text-cyan-700">{label}</Label>
        <Button variant="outline" disabled className="w-full justify-between">
          Loading teams...
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Label className="text-sm font-medium text-cyan-700">{label}</Label>
      <div className="relative">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          {getDisplayText()}
          <ChevronDown className="h-4 w-4" />
        </Button>
        
        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {/* Select All option */}
            <div className="p-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={handleSelectAll}
              >
                {selectedTeams.length === teams.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            {/* Team options */}
            <div className="p-2 space-y-1">
              {teams.map((team) => (
                <div
                  key={team.team_name}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded cursor-pointer"
                  onClick={() => handleTeamToggle(team.team_name)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTeams.includes(team.team_name)}
                    onChange={() => {}} // Handled by parent div onClick
                    className="rounded"
                  />
                  <span className="text-sm">{team.city_and_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
