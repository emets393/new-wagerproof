// Node Name: fetchLeagueMarkets
// Purpose: Fetch and filter Polymarket sports betting markets for one league.
// Inputs (NodeInputs):
//   - sport (string, required)  e.g. "nfl", "nba"
//   - limit (number, optional)  default 100
//   - onlyGameMarkets (boolean, optional) default true
//
// Output:
//   {
//     sport: "nfl",
//     tagId: "450",
//     seriesId: "10187",
//     ordering: "away",
//     markets: [
//       {
//         eventSlug,
//         eventTitle,        // "Chiefs vs. Bills"
//         homeTeam,          // "Bills"
//         awayTeam,          // "Chiefs"
//         gameStartTime,
//         marketSlug,
//         marketType,        // "moneyline" | "spread" | "total" | "1h_moneyline" | "1h_total" | "other"
//         question,          // "Chiefs vs. Bills: 1H Moneyline"
//         yesTokenId,
//         noTokenId,
//         active,
//         closed,
//       }
//     ]
//   }

export default async function fetchLeagueMarkets(
  { sport, limit, onlyGameMarkets }: NodeInputs,
  { logging }: NodeScriptOptions
) {
  try {
    if (!sport || typeof sport !== "string") {
      throw new Error("sport is required, e.g. 'nfl'");
    }

    // default filtering behavior
    const _onlyGameMarkets =
      typeof onlyGameMarkets === "boolean" ? onlyGameMarkets : true;

    // --- helpers ----------------------------------------------------------

    function extractYesNoTokens(market) {
      if (Array.isArray(market.tokens)) {
        const yesObj = market.tokens.find(
          t => (t.outcome || "").toLowerCase() === "yes"
        );
        const noObj = market.tokens.find(
          t => (t.outcome || "").toLowerCase() === "no"
        );
        return {
          yesTokenId: yesObj ? yesObj.token_id : null,
          noTokenId: noObj ? noObj.token_id : null
        };
      }

      if (typeof market.clobTokenIds === "string") {
        try {
          const arr = JSON.parse(market.clobTokenIds);
          if (Array.isArray(arr) && arr.length >= 2) {
            return { yesTokenId: arr[0], noTokenId: arr[1] };
          }
        } catch (_) {}
      }

      return { yesTokenId: null, noTokenId: null };
    }

    // Try to classify a market type from its slug or question
    function classifyMarketType(q, slug) {
      const lowerQ = (q || "").toLowerCase();
      const lowerSlug = (slug || "").toLowerCase();

      // first-half variants
      if (lowerQ.includes("1h") || lowerSlug.includes("1h")) {
        if (lowerQ.includes("moneyline") || lowerSlug.includes("moneyline")) {
          return "1h_moneyline";
        }
        if (lowerQ.includes("o/u") || lowerQ.includes("total")) {
          return "1h_total";
        }
      }

      // full game
      if (lowerQ.includes("moneyline") || lowerSlug.includes("moneyline")) {
        return "moneyline";
      }
      if (lowerQ.includes("spread") || lowerSlug.includes("spread")) {
        return "spread";
      }
      if (
        lowerQ.includes("o/u") ||
        lowerQ.includes("total") ||
        lowerSlug.includes("total")
      ) {
        return "total";
      }

      return "other";
    }

    // Extract "Chiefs" and "Bills" from "Chiefs vs. Bills"
    function parseTeamsFromTitle(title) {
      if (!title || typeof title !== "string") {
        return { awayTeam: null, homeTeam: null };
      }

      // Patterns seen in Polymarket:
      // "Chiefs vs. Bills"
      // "Bears @ Packers"
      // We'll try both separators.
      let awayTeam = null;
      let homeTeam = null;

      if (title.includes(" vs. ")) {
        const [t1, t2] = title.split(" vs. ").map(s => s.trim());
        if (t1 && t2) {
          awayTeam = t1;
          homeTeam = t2;
        }
      } else if (title.includes(" @ ")) {
        const [t1, t2] = title.split(" @ ").map(s => s.trim());
        if (t1 && t2) {
          awayTeam = t1;
          homeTeam = t2;
        }
      }

      return { awayTeam, homeTeam };
    }

    async function fetchJson(url) {
      logging.log(`GET ${url}`);
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "BuildShip-PolymarketSportsFetcher/1.1"
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Request failed ${res.status}: ${text}`);
      }

      return res.json();
    }

    // --- 1. Discover league metadata (/sports) ----------------------------

    const sportsMetaUrl = "https://gamma-api.polymarket.com/sports";
    const sportsList = await fetchJson(sportsMetaUrl);

    if (!Array.isArray(sportsList) || sportsList.length === 0) {
      throw new Error("Empty /sports response");
    }

    const row = sportsList.find(
      s => (s.sport || "").toLowerCase() === sport.toLowerCase()
    );

    if (!row) {
      throw new Error(
        `Sport '${sport}' not found in /sports. Available: ${sportsList
          .map(s => s.sport)
          .join(", ")}`
      );
    }

    // tags is comma-separated like "1,450,100639"
    const tagCandidates = (row.tags || "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    if (tagCandidates.length === 0) {
      throw new Error(`No tags for sport '${sport}'`);
    }

    // Prefer the first tag that's not "1" (Polymarket sticks "1" everywhere as a generic umbrella tag)
    const primaryTagId =
      tagCandidates.find(t => t !== "1") || tagCandidates[0];

    logging.log(
      `Resolved sport=${sport} tagId=${primaryTagId} series=${row.series} ordering=${row.ordering}`
    );

    // --- 2. Fetch events for this specific league -------------------------

    const _limit =
      typeof limit === "number" && !Number.isNaN(limit) ? limit : 100;

    const paramsEv = new URLSearchParams();
    paramsEv.append("tag_id", primaryTagId);
    paramsEv.append("closed", "false");
    paramsEv.append("limit", _limit.toString());
    paramsEv.append("related_tags", "true");

    const eventsUrl = `https://gamma-api.polymarket.com/events?${paramsEv.toString()}`;
    const eventsPayload = await fetchJson(eventsUrl);

    const eventsArray = Array.isArray(eventsPayload)
      ? eventsPayload
      : Array.isArray(eventsPayload.events)
      ? eventsPayload.events
      : Array.isArray(eventsPayload.data)
      ? eventsPayload.data
      : [];

    // --- 3. Flatten and filter markets ------------------------------------

    const flattened = [];

    for (const ev of eventsArray) {
      const eventSlug = ev.slug || ev.ticker || null;
      const eventTitle = ev.title || ev.name || ev.question || null;

      const gameStartTime =
        ev.game_start_time ||
        ev.gameStartTime ||
        ev.startDate ||
        ev.start_time ||
        null;

      const { awayTeam, homeTeam } = parseTeamsFromTitle(eventTitle || "");

      // get markets array on this event
      const eventMarkets = Array.isArray(ev.markets)
        ? ev.markets
        : ev.markets?.data && Array.isArray(ev.markets.data)
        ? ev.markets.data
        : [];

      for (const mkt of eventMarkets) {
        // Keep only currently tradable stuff
        if (mkt.active !== true || mkt.closed === true) continue;

        const question = mkt.question || mkt.title || "";
        const marketSlug = mkt.slug || mkt.market_slug || "";
        const { yesTokenId, noTokenId } = extractYesNoTokens(mkt);

        // classify type (moneyline, total, etc.)
        const marketType = classifyMarketType(question, marketSlug);

        // Filtering logic:
        // If onlyGameMarkets=true, we prefer lines that mention *both* teams,
        // e.g. "Chiefs vs. Bills: 1H Moneyline"
        // We drop team-only totals like "Bills Team Total".
        let include = true;
        if (_onlyGameMarkets) {
          include = false;

          // require both team names if we were able to parse them
          if (awayTeam && homeTeam) {
            const qLower = question.toLowerCase();
            const awayHit = qLower.includes(awayTeam.toLowerCase());
            const homeHit = qLower.includes(homeTeam.toLowerCase());

            // ex: "Chiefs vs. Bills: O/U 52.5" hits both
            if (awayHit && homeHit) {
              include = true;
            }

            // Some books phrase like "Chiefs vs. Bills: 1H Moneyline"
            // which still hits both. Good.
          }

          // fallback: if we couldn't parse teams (rare), keep obvious full-game markets
          if (!awayTeam || !homeTeam) {
            if (
              marketType === "moneyline" ||
              marketType === "spread" ||
              marketType === "total" ||
              marketType === "1h_moneyline" ||
              marketType === "1h_total"
            ) {
              include = true;
            }
          }
        }

        if (!include) continue;

        flattened.push({
          eventSlug,
          eventTitle,
          awayTeam,
          homeTeam,
          gameStartTime,
          marketSlug,
          marketType,
          question,
          yesTokenId,
          noTokenId,
          active: mkt.active === true,
          closed: mkt.closed === true
        });
      }
    }

    logging.log(
      `fetchLeagueMarkets(filtered): sport=${sport} -> ${flattened.length} markets after filter`
    );

    // --- 4. return clean set ----------------------------------------------

    return {
      sport: row.sport,
      tagId: primaryTagId,
      seriesId: row.series,
      ordering: row.ordering, // "away" means first team in title is away
      markets: flattened
    };
  } catch (err) {
    logging.log(`fetchLeagueMarkets error: ${err.message}`);
    throw new Error(`fetchLeagueMarkets failed: ${err.message}`);
  }
}
