import debug from '@/utils/debug';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TeamSelectorProps {
  label: string;
  selectedTeams: string[];
  onTeamsChange: (teams: string[]) => void;
  className?: string;
}

interface MLBTeam {
  short_name: string;
  full_name: string;
}

export default function TeamSelector({ label, selectedTeams, onTeamsChange, className }: TeamSelectorProps) {
  const [teams, setTeams] = useState<MLBTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data, error } = await supabase
          .from('MLB_Teams')
          .select('short_name, full_name')
          .order('short_name');
        
        if (error) {
          debug.error('Error fetching teams:', error);
          return;
        }
        
        setTeams(data || []);
      } catch (error) {
        debug.error('Error in fetchTeams:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, []);

  const handleTeamToggle = (teamShortName: string) => {
    const newSelectedTeams = selectedTeams.includes(teamShortName)
      ? selectedTeams.filter(team => team !== teamShortName)
      : [...selectedTeams, teamShortName];
    
    onTeamsChange(newSelectedTeams);
  };

  const handleSelectAll = () => {
    if (selectedTeams.length === teams.length) {
      onTeamsChange([]);
    } else {
      onTeamsChange(teams.map(team => team.short_name));
    }
  };

  const getDisplayText = () => {
    if (selectedTeams.length === 0) {
      return "All Teams";
    } else if (selectedTeams.length === teams.length) {
      return "All Teams";
    } else if (selectedTeams.length === 1) {
      return selectedTeams[0];
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
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            {getDisplayText()}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 max-h-80 overflow-y-auto">
          <div className="p-2">
            <div className="flex items-center space-x-2 pb-2 mb-2 border-b">
              <Checkbox
                id="select-all"
                checked={selectedTeams.length === teams.length}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="font-medium cursor-pointer">
                All Teams
              </Label>
            </div>
            
            {teams.map((team) => (
              <div key={team.short_name} className="flex items-center space-x-2 py-1">
                <Checkbox
                  id={team.short_name}
                  checked={selectedTeams.includes(team.short_name)}
                  onCheckedChange={() => handleTeamToggle(team.short_name)}
                />
                <Label htmlFor={team.short_name} className="cursor-pointer text-sm">
                  {team.short_name} - {team.full_name}
                </Label>
              </div>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
