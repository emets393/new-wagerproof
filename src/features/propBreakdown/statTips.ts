/** Plain-English glossary for prop-breakdown stats — display copy only. */

export const BASELINE_TIPS: Record<string, string> = {
  receptions:
    'Catches per game last season. The volume floor for receptions props — more targets usually mean more catches.',
  targets:
    'Times thrown the ball per game last season. Opportunity volume — the raw input behind receptions and yards props.',
  rec_yds:
    'Receiving yards per game last season. The season-rate baseline for receiving-yard props before the matchup.',
  rush_att:
    'Rushing attempts per game last season. Workload — the volume that drives rushing-yard and attempt props.',
  rush_yds:
    'Rushing yards per game last season. The season-rate baseline for rushing-yard props before the box matchup.',
  pass_att:
    'Pass attempts per game last season. Dropback volume — the engine behind passing-yard and completion props.',
  pass_yds:
    'Passing yards per game last season. The season-rate baseline for passing-yard props before the scheme layer.',
  pass_td:
    'Passing touchdowns per game last season. Scoring rate context for pass-TD and anytime-TD props.',
  total_td:
    'Total touchdowns last season (pass + rush + rec). The scoring-rate baseline for anytime-TD props.',
};

export const NGS_TIPS: Record<string, string> = {
  separation:
    'Average yards of space he creates from the nearest defender at the moment the ball arrives. The best route-runners live above 3.0.',
  cushion:
    'How far defenders line up off him at the snap. Big cushion = defenses fear his speed; small cushion = they press him.',
  adot: 'Average depth of target — how far downfield his targets travel. High = deep threat, low = short-game volume.',
  air_share:
    "His share of the team's total intended deep yardage. The single best measure of how much the offense funnels through him.",
  yac_above_exp:
    'Yards after catch beyond what an average receiver gains from the same catch spots. Positive = creates extra yards on his own.',
  catch_pct: 'Percentage of his targets he catches. Volume-safe hands metric.',
  drop_rate:
    'Drops as a share of catchable targets (charted). Served so a higher rank = safer hands.',
  contested_catch:
    'How often he wins when the defender is draped on him at the catch point (charted). The 50/50-ball skill — big for TD props.',
  created_rate:
    'Share of his catches that charting graded as created by the receiver (not scheme) — separation or spectacular play.',
  rz_tgt_share:
    "His share of the team's targets inside the 20 this past season. The TD-opportunity stat.",
  rz_carry_share:
    "His share of the team's carries inside the 20 this past season. Goal-line role = TD equity.",
  ryoe_per_att:
    'Rush yards over expected per carry — what he gains beyond what blocking and box count predict. The purest RB skill number.',
  efficiency:
    'North-south score: total distance traveled per yard gained. LOWER = more decisive, downhill runner (descriptive).',
  eight_box_pct:
    'How often defenses stack 8+ in the box against him — the respect he commands, and the context for the box matchup below.',
  time_to_los:
    'Seconds from handoff to crossing the line of scrimmage. Quick = one-cut; slow = patient/bounce runner (descriptive).',
  cpoe: 'Completion percentage above expected — accuracy after accounting for how hard his throws are. The best single QB skill stat.',
  time_to_throw:
    'Average seconds from snap to release. Quick release beats pressure; long hold = deep shots but sack risk.',
  intended_air_yds:
    'Average depth of his throws. High = aggressive downfield offense — pairs with passing-yard upside.',
  air_yds_to_sticks:
    'How far beyond the first-down marker he throws on average. Positive = attacks past the sticks.',
  aggressiveness:
    'Share of throws into tight windows (defender within a yard). High = trusts his arm into coverage.',
  int_worthy_rate:
    'Charted share of dropbacks with a throw that should have been intercepted. Served so a higher rank = fewer dangerous throws.',
  pa_rate: 'Share of his dropbacks using play-action (descriptive — scheme usage, not skill).',
  completed_air_yds:
    'Average downfield distance of his completions — how much of his yardage flies through the air.',
  comp_pct: 'Straight completion percentage on attempts.',
};

export const DEFENSE_TIPS: Record<string, string> = {
  man: 'Share of snaps this defense plays man coverage (one defender assigned to one receiver).',
  zone: 'Share of snaps this defense plays zone coverage (defenders cover areas).',
  two_high: 'Share of snaps with two deep safeties (two-high shell) — often softer vs the deep ball.',
  pressure: 'Share of dropbacks where the defense generates pressure on the QB.',
  blitz: 'Share of dropbacks where 5+ rushers are sent (blitz).',
  heavy_box: 'Share of snaps with 8+ defenders in the box — stacked vs the run.',
  light_box: 'Share of snaps with 6 or fewer in the box — lighter vs the run, more coverage depth.',
};

export const COVERAGE_TIPS: Record<string, string> = {
  zone: 'Career production against zone coverage, with league percentile among qualified peers.',
  man: 'Career production against man coverage, with league percentile among qualified peers.',
  two_high: 'Career production vs two-high shells, with league percentile among qualified peers.',
  one_high: 'Career production vs single-high (one deep safety), with league percentile among qualified peers.',
  pressure: 'QB EPA per dropback (and support stats) when the defense generates pressure.',
  blitz: 'QB EPA per dropback (and support stats) when 5+ rushers are sent.',
  heavy_box: 'Rushing production vs 8+ defenders in the box.',
  neutral: 'Rushing production vs a standard (7) box.',
  light_box: 'Rushing production vs 6 or fewer in the box.',
};

export const CLUSTER_TIPS = {
  who: 'Season baseline averages plus charting / Next Gen Stats for this market — headline tiles first, more in the expander.',
  defense:
    'How often the opponent’s defense uses each scheme look. Rate = share of snaps; %ile = league rank for that rate.',
  look: 'How this player has performed historically against the coverage looks this defense favors.',
  team: 'Career record for this market against today’s opponent (needs at least 2 meetings).',
  last10: 'Result of this market in his last 10 tracked games (O/U or Y/N). Newest on the right.',
  situations: 'Served situational win rates (home/away/division/primetime) for this market — no client math.',
};

/** Canonical order for full defense profile (only keys present in the row render). */
export const ALL_DEFENSE_KEYS = [
  'man',
  'zone',
  'two_high',
  'pressure',
  'blitz',
  'heavy_box',
  'light_box',
] as const;
