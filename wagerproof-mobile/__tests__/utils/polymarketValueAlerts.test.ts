import { detectValueAlerts } from '../../utils/polymarketValueAlerts';

describe('polymarketValueAlerts', () => {
  const mockAwayTeam = 'Buffalo Bills';
  const mockHomeTeam = 'Kansas City Chiefs';

  it('returns empty array for null data', () => {
    expect(detectValueAlerts(null, mockAwayTeam, mockHomeTeam)).toEqual([]);
  });

  it('returns empty array for undefined data', () => {
    expect(detectValueAlerts(undefined, mockAwayTeam, mockHomeTeam)).toEqual([]);
  });

  it('returns empty array for game that has started', () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const data = {
      spread: { currentAwayOdds: 60, currentHomeOdds: 40 },
    } as any;

    expect(detectValueAlerts(data, mockAwayTeam, mockHomeTeam, pastDate)).toEqual([]);
  });

  describe('spread alerts', () => {
    it('detects away spread value when > 57%', () => {
      const data = {
        spread: { currentAwayOdds: 62, currentHomeOdds: 38 },
      } as any;

      // Use future date to avoid game-started check
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam, futureDate);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].market).toBe('spread');
      expect(alerts[0].side).toBe('away');
      expect(alerts[0].percentage).toBe(62);
      expect(alerts[0].team).toBe(mockAwayTeam);
    });

    it('detects home spread value when > 57%', () => {
      const data = {
        spread: { currentAwayOdds: 40, currentHomeOdds: 60 },
      } as any;

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam, futureDate);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].side).toBe('home');
      expect(alerts[0].team).toBe(mockHomeTeam);
    });

    it('no spread alert when both sides < 57%', () => {
      const data = {
        spread: { currentAwayOdds: 52, currentHomeOdds: 48 },
      } as any;

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam, futureDate);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('total alerts', () => {
    it('detects over value when > 57%', () => {
      const data = {
        total: { currentAwayOdds: 60, currentHomeOdds: 40 },
      } as any;

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam, futureDate);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].market).toBe('total');
      expect(alerts[0].team).toBe('Over');
    });

    it('detects under value when > 57%', () => {
      const data = {
        total: { currentAwayOdds: 40, currentHomeOdds: 60 },
      } as any;

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam, futureDate);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].team).toBe('Under');
    });
  });

  describe('moneyline alerts', () => {
    it('detects moneyline alert only at 85%+ threshold', () => {
      const data = {
        moneyline: { currentAwayOdds: 80, currentHomeOdds: 20 },
      } as any;

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam, futureDate);
      // 80% is below 85% threshold for moneyline
      expect(alerts).toHaveLength(0);
    });

    it('detects moneyline alert at 85%+', () => {
      const data = {
        moneyline: { currentAwayOdds: 88, currentHomeOdds: 12 },
      } as any;

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam, futureDate);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].market).toBe('moneyline');
      expect(alerts[0].percentage).toBe(88);
    });
  });

  describe('multiple alerts', () => {
    it('returns multiple alerts from different markets', () => {
      const data = {
        spread: { currentAwayOdds: 60, currentHomeOdds: 40 },
        total: { currentAwayOdds: 40, currentHomeOdds: 62 },
        moneyline: { currentAwayOdds: 90, currentHomeOdds: 10 },
      } as any;

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam, futureDate);
      expect(alerts).toHaveLength(3); // spread away, total under, ML away
    });
  });

  describe('date handling', () => {
    it('allows alerts when no gameDate provided', () => {
      const data = {
        spread: { currentAwayOdds: 60, currentHomeOdds: 40 },
      } as any;

      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam);
      expect(alerts).toHaveLength(1);
    });

    it('allows alerts for date-only strings in the future', () => {
      const data = {
        spread: { currentAwayOdds: 60, currentHomeOdds: 40 },
      } as any;

      // Date-only string gets T23:59:59Z appended, so tomorrow works
      const tomorrow = new Date(Date.now() + 86400000);
      const dateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
      const alerts = detectValueAlerts(data, mockAwayTeam, mockHomeTeam, dateStr);
      expect(alerts).toHaveLength(1);
    });
  });
});
