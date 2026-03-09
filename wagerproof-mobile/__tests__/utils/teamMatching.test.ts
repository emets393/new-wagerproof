import { normalizeTeamName, teamsMatch, findMatchingTeam, gamesMatch } from '../../utils/teamMatching';

describe('mobile teamMatching', () => {
  describe('normalizeTeamName', () => {
    it('returns empty string for empty input', () => {
      expect(normalizeTeamName('')).toBe('');
    });

    it('lowercases and trims', () => {
      expect(normalizeTeamName('  CHIEFS  ')).toBe('chiefs');
    });

    it('collapses extra whitespace', () => {
      expect(normalizeTeamName('Kansas   City')).toBe('kansas city');
    });

    it('removes "the" prefix', () => {
      expect(normalizeTeamName('The Buckeyes')).toBe('buckeyes');
    });
  });

  describe('teamsMatch', () => {
    it('matches exact same names', () => {
      expect(teamsMatch('Kansas City Chiefs', 'Kansas City Chiefs')).toBe(true);
    });

    it('matches case-insensitive', () => {
      expect(teamsMatch('chiefs', 'CHIEFS')).toBe(true);
    });

    it('matches abbreviation to full name', () => {
      expect(teamsMatch('KC', 'Kansas City Chiefs')).toBe(true);
    });

    it('matches nickname to canonical', () => {
      expect(teamsMatch('Buckeyes', 'Ohio State')).toBe(true);
    });

    it('returns false for empty input', () => {
      expect(teamsMatch('', 'Team')).toBe(false);
      expect(teamsMatch('Team', '')).toBe(false);
    });

    // Known limitation: NY Giants and NY Jets match due to shared city extraction
    it('known limitation: NY Giants and NY Jets match due to shared city', () => {
      expect(teamsMatch('New York Giants', 'New York Jets')).toBe(true);
    });

    it('does not match completely unrelated teams', () => {
      expect(teamsMatch('Kansas City Chiefs', 'Buffalo Bills')).toBe(false);
    });

    // NFL-specific
    it('matches NFL team by abbreviation', () => {
      expect(teamsMatch('PHI', 'Philadelphia Eagles')).toBe(true);
    });

    it('matches historical Oakland Raiders to Las Vegas Raiders', () => {
      expect(teamsMatch('Oakland Raiders', 'Las Vegas Raiders')).toBe(true);
    });

    // CFB-specific
    it('matches CFB team variations', () => {
      expect(teamsMatch('TAMU', 'Texas A&M')).toBe(true);
    });

    it('matches USC to Southern California', () => {
      expect(teamsMatch('USC', 'Southern California')).toBe(true);
    });
  });

  describe('findMatchingTeam', () => {
    const games = [
      { home_team: 'Dallas Cowboys', away_team: 'Philadelphia Eagles' },
      { home_team: 'Green Bay Packers', away_team: 'Chicago Bears' },
    ];

    it('finds home team match', () => {
      const result = findMatchingTeam('DAL', games, 'home_team');
      expect(result?.home_team).toBe('Dallas Cowboys');
    });

    it('finds away team match', () => {
      const result = findMatchingTeam('Bears', games, 'away_team');
      expect(result?.away_team).toBe('Chicago Bears');
    });

    it('returns undefined for no match', () => {
      expect(findMatchingTeam('Miami Dolphins', games, 'home_team')).toBeUndefined();
    });
  });

  describe('gamesMatch', () => {
    it('matches identical games', () => {
      expect(gamesMatch(
        { home_team: 'Dallas Cowboys', away_team: 'Philadelphia Eagles' },
        { home_team: 'Dallas Cowboys', away_team: 'Philadelphia Eagles' },
      )).toBe(true);
    });

    it('matches with abbreviations', () => {
      expect(gamesMatch(
        { home_team: 'DAL', away_team: 'PHI' },
        { home_team: 'Dallas Cowboys', away_team: 'Philadelphia Eagles' },
      )).toBe(true);
    });

    it('does not match swapped teams', () => {
      expect(gamesMatch(
        { home_team: 'Dallas Cowboys', away_team: 'Philadelphia Eagles' },
        { home_team: 'Philadelphia Eagles', away_team: 'Dallas Cowboys' },
      )).toBe(false);
    });
  });
});
