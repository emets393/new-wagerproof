import './prop-cards.css';
import { BookMark, pickPropBook } from './BookMark';
import { CardHero, PropCard, StatTiles } from './CardHero';
import { ContextStrip } from './ContextStrip';
import { CoverageWheel } from './CoverageWheel';
import { DuelRow } from './DuelRow';
import { GameLog } from './GameLog';
import { OwnName, OwnerLine, PlayerMark, TeamMark } from './Marks';
import { SchemeRead } from './SchemeRead';

const MINUS = '\u2212';
const EAGLES = '#004C54';
const COWBOYS = '#041E42';
const SMITH_HEADSHOT = 'https://static.www.nfl.com/image/upload/f_auto,q_auto/league/vj2fz8veorg1k5qthnjm';
const LINE_BOOK = pickPropBook(['draftkings', 'fanduel']);

function playerMark(size: number) {
  return <PlayerMark initials="DS" color={EAGLES} title="DeVonta Smith" size={size} photo={SMITH_HEADSHOT} />;
}

function dallasMark(size: number) {
  return <TeamMark team="DAL" title="Dallas" color={COWBOYS} size={size} />;
}

function versus(name: string) {
  return (
    <OwnerLine>
      <OwnName mark={playerMark(28)} name="DeVonta Smith" />
      {' vs '}
      <OwnName mark={dallasMark(26)} name={name} />
    </OwnerLine>
  );
}

export function DeVontaSmithCard() {
  return (
    <div className="prop-cards" data-prop-card="devonta-smith">
      <ContextStrip
        kicker={
          <>
            <span className="nmb sm">1</span>
            The game
          </>
        }
        matchup={{
          away: { team: 'PHI', name: 'Philadelphia', color: EAGLES },
          home: { team: 'DAL', name: 'Dallas', color: COWBOYS },
          detail: 'NFC East · AT&T Stadium, roof closed',
        }}
        facts={[
          { label: 'Spread', value: 'Philadelphia by 3' },
          { label: 'Total', value: '47.5' },
          { label: 'Implied', value: 'PHI 25.2 · DAL 22.2' },
        ]}
        chips={[{ label: 'Weather', value: 'indoors — suppressed', suppressed: true }]}
      />

      <SchemeRead
        kicker={
          <>
            <span className="nmb sm">2</span>
            The trenches — shared by every Philadelphia card
          </>
        }
        sentence="Dallas wins the pocket, decisively. Expect dropbacks under duress, first reads, and scrambles."
      >
        Pass protection edge <b>{MINUS}11.9 points</b> — Philadelphia allow pressure on 42.8% of
        dropbacks, 30th of 32, against a Dallas rush generating 43.5%, 3rd of 32. Run blocking is a
        wash. Hurts throws at 2.85s into pressure arriving at 2.55s.
      </SchemeRead>

      <div className="decks">
        <div className="deck">
          <PropCard tier="t3" className="hero">
            <div className="who">
              {playerMark(64)}
              <div className="id">
                <div className="idrow">
                  <span className="badge">WR</span>
                  <span className="mt">PHI at DAL · Week 12</span>
                </div>
                <h2>DeVonta Smith</h2>
                <p className="mkttype">Receiving yards</p>
              </div>
            </div>
            <div className="verses">
              <div className="vcell line">
                <div className="k">The number</div>
                <div className="v linebook">
                  {LINE_BOOK ? <BookMark bookKey={LINE_BOOK} /> : null}
                  58.5
                </div>
                <div className="n">o {MINUS}114 / u {MINUS}114</div>
              </div>
              <div className="gapchip pos">+7.3</div>
              <div className="vcell">
                <div className="k">His baseline</div>
                <div className="v">65.8</div>
                <div className="n">blended, 10 games</div>
              </div>
            </div>
            <p className="how">
              30.5 routes a game at 2.27 yards a route, a 25.8% target share and an <b>11.9 aDOT</b> —
              the deepest profile of Philadelphia&apos;s three. Hold that last number; the trench read
              argues with it.
            </p>
          </PropCard>

          <PropCard tier="t3" className="glog" title="Every game against that week's number" meta="fixed row">
            <GameLog
              hero={
                <CardHero value="+4.2 yds" tone="pos">
                  his median result against his own line, and he cleared it <b>5 of 10</b>
                </CardHero>
              }
              weeks={[
                { label: 'W1', margin: -38 },
                { label: 'W2', margin: -10 },
                { label: 'W3', margin: 10 },
                { label: 'W4', margin: -20 },
                { label: 'W5', margin: 68 },
                { label: 'W6', margin: -2 },
                { label: 'W7', margin: 132 },
                { label: 'W8', margin: 12 },
                { label: 'W10', margin: 15 },
                { label: 'W11', margin: -48 },
              ]}
              note={
                <>
                  The most volatile log of the three Philadelphia receivers: a 183-yard week and an
                  8-yard week inside five games of each other.
                </>
              }
            />
          </PropCard>
        </div>

        <div className="deck">
          <PropCard tier="t3" title="What Dallas allows receivers" meta="vs league average">
            <OwnerLine>
              <OwnName mark={dallasMark(26)} name="Dallas" />
              {' · fixed row'}
            </OwnerLine>
            <CardHero value="+6.3 yds" tone="pos">
              <b>Smith&apos;s side</b> — Dallas give up more than an average defence here, worth this
              much at his 31.7% share
            </CardHero>
            <div className="rows">
              <DuelRow
                label="Catches they allow"
                detail="Dallas allow 11.40 catches a game. A league-average defense allows 11.43."
                tone="nil"
                side="defense"
                winner="a wash"
                value={`${MINUS}0.3%`}
                rank="16th of 32"
                reach={0.7}
              />
              <DuelRow
                label="Yards per catch"
                detail="Dallas allow 14.33 yards each time a receiver makes a catch. A league-average defense allows 12.55."
                tone="pos"
                side="player"
                winner="Smith"
                mark={playerMark(17)}
                value="+14.2%"
                reach={35.4}
              />
            </div>
            <p className="note">
              <b>Dallas do not concede catches, they concede yards.</b> Receptions dead level at 16th,
              targets actually below average at 22nd, and yards per catch +14.2% — which multiplies
              out to +13.9% on receiving yards, 7th of 32.
            </p>
          </PropCard>

          <PropCard tier="t3" title="Where he lines up" meta="vs league average">
            {versus('Dallas')}
            <CardHero value="+2.1 yds" tone="pos">
              <b>nearly a wash</b> — Dallas own the slot half, Smith owns the wide half, and they
              almost cancel
            </CardHero>
            <div className="rows">
              <DuelRow
                label="Slot"
                detail="57.3% of his routes start in the slot. Dallas allow 57.1 yards a game to receivers lined up there. A league-average defense allows 68.0."
                tone="neg"
                side="defense"
                winner="Dallas"
                mark={dallasMark(17)}
                value={`${MINUS}16.1%`}
                rank="25th of 32"
                reach={23.6}
              />
              <DuelRow
                label="Out wide"
                detail="42.7% of his routes start out wide. Dallas allow 130.9 yards a game to receivers lined up there. A league-average defense allows 100.8."
                tone="pos"
                side="player"
                winner="Smith"
                mark={playerMark(17)}
                value="+29.9%"
                rank="2nd of 32"
                reach={44}
              />
            </div>
          </PropCard>

          <PropCard tier="t3" title="What Dallas sits in, and how he does in it" meta="yards a route">
            {versus('Dallas coverage mix')}
            <CardHero value="72 yds" tone="pos">
              Weight each coverage by how often Dallas plays it, and Smith comes out at 72 receiving
              yards. The line is <b>58.5</b>.
            </CardHero>
            <CoverageWheel
              label="Dallas coverage mix with DeVonta Smith's yards per route against each shell"
              defenseName="Dallas"
              composite="2.37"
              season={2.18}
              seasonLabel="his usual is 2.18"
              unit="yards each route"
              shells={[
                { name: 'Cover 3', pct: 38, yardsPerRoute: 1.57, routes: 22 },
                { name: 'Cover 2', pct: 21, yardsPerRoute: 4.87, routes: 19 },
                { name: 'Cover 1', pct: 17, yardsPerRoute: 1.58, routes: 22 },
                { name: 'Cover 4', pct: 13, yardsPerRoute: 1.76, routes: 40 },
                { name: 'Cover 6', pct: 8, yardsPerRoute: null, routes: null },
                { name: 'Cover 0', pct: 5, yardsPerRoute: 2.13, routes: 50 },
              ]}
              note={
                <p className="note">
                  <b>Dallas sits in Cover 3 more than anything, and that row above is his lowest</b> — 1.57
                  yards a route, from 22 routes. Cover 2 is the high one, 4.87 yards a route, and Dallas
                  plays it about a fifth of the time.
                </p>
              }
            />
          </PropCard>
        </div>

        <div className="deck">
          <PropCard tier="t3" title="Who the quarterback looks to first" meta="Smith's share of first reads">
            <p className="lede">
              A first read is the receiver the quarterback looks for before anyone else. The line in
              the middle of each bar is 20% of a team&apos;s first reads. The right end is 34%. The
              green bar is how far Smith sits above that 20% line.
            </p>
            <CardHero value="+0.4 pts" tone="nil">
              Almost unchanged against Dallas. His share moves from 31.4% to 31.8%.
            </CardHero>
            <div className="rows">
              <DuelRow
                duel={false}
                label="This season"
                detail="55 of Philadelphia's 175 first reads. That is 31.4% of the team, the most of the three, and 11.4 points above the middle line."
                tone="pos"
                side="player"
                value="+11.4%"
                rank="31.4% of the team"
                reach={40.7}
              />
              <DuelRow
                duel={false}
                label="Against Dallas"
                detail="Weighted by how often Dallas plays each coverage. His share moves to 31.8%, which is 11.8 points above the middle line."
                tone="pos"
                side="player"
                value="+11.8%"
                rank="31.8% vs Dallas"
                reach={42.1}
              />
            </div>
            <div className="axis">
              <div className="ends">
                <span>below 20%</span>
                <span>20%</span>
                <span>34%</span>
              </div>
            </div>
          </PropCard>

          <PropCard tier="t3" title="His route tree" meta="yards vs an average defence">
            {versus('Dallas')}
            <CardHero value="+1.3 yds" tone="pos">
              <b>Smith&apos;s side, barely</b> — two branches he wins, three Dallas win, a yard of
              daylight in total
            </CardHero>
            <div className="rows">
              <DuelRow
                label="Hitch"
                detail="23.8% of his routes, 7.3 a game. Dallas allow 1.65 yards a route on hitches. The league allows 1.45."
                tone="pos"
                side="player"
                winner="Smith"
                mark={playerMark(17)}
                value="+1.5 yds"
                rank="11th of 32"
                reach={25}
              />
              <DuelRow
                label="Go"
                detail="18.7% of his routes, 5.7 a game. Dallas allow 1.79 yards a route on go routes. The league allows 1.31."
                tone="pos"
                side="player"
                winner="Smith"
                mark={playerMark(17)}
                value="+2.7 yds"
                rank="6th of 32"
                reach={45}
              />
              <DuelRow
                label="Out"
                detail="12.0% of his routes, 3.7 a game. Dallas allow 1.64 yards a route. The league allows 1.71."
                tone="nil"
                side="defense"
                winner="a wash"
                value={`${MINUS}0.3 yds`}
                rank="18th of 32"
                reach={5}
              />
              <DuelRow
                label="Crossers"
                detail="10.3% of his routes, 3.1 a game. Dallas allow 1.10 yards a route on crossers. The league allows 1.55."
                tone="neg"
                side="defense"
                winner="Dallas"
                mark={dallasMark(17)}
                value={`${MINUS}1.4 yds`}
                rank="27th of 32"
                reach={23.3}
              />
              <DuelRow
                label="In / dig"
                detail="7.6% of his routes, 2.3 a game. Dallas allow 1.10 yards a route. The league allows 1.16."
                tone="nil"
                side="defense"
                winner="a wash"
                value={`${MINUS}0.1 yds`}
                rank="18th of 32"
                reach={1.7}
              />
              <DuelRow
                label="Slant"
                detail="6.9% of his routes, 2.1 a game. Dallas allow 1.33 yards a route on slants. The league allows 1.85."
                tone="neg"
                side="defense"
                winner="Dallas"
                mark={dallasMark(17)}
                value={`${MINUS}1.1 yds`}
                rank="26th of 32"
                reach={18.3}
              />
            </div>
          </PropCard>

          <PropCard tier="t3" title="His usage, entering" meta="no matchup component">
            <StatTiles
              tiles={[
                { label: 'Target share', value: '25.8', unit: '%' },
                { label: 'Route share', value: '94.7', unit: '%' },
                { label: 'Snap share', value: '91.7', unit: '%' },
                { label: 'Routes/game', value: '30.5' },
                { label: 'aDOT', value: '11.9' },
                { label: 'Catchable', value: '85.6', unit: '%' },
              ]}
            />
            <p className="note">
              A 94.7% route share is the number that makes everything above matter — he is on the
              field for essentially every dropback.
            </p>
          </PropCard>
        </div>
      </div>
    </div>
  );
}

export function PropCardHarness() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-[1340px]">
        <DeVontaSmithCard />
      </div>
    </main>
  );
}
