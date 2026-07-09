package com.wagerproof.app.visual

import com.wagerproof.app.features.props.NFLPlayerPropSelection
import com.wagerproof.app.features.props.NFLPropFeed
import com.wagerproof.app.features.props.PropsFixtures
import com.wagerproof.core.models.CFBPrediction
import com.wagerproof.core.models.MLBGame
import com.wagerproof.core.models.NBAGame
import com.wagerproof.core.models.NCAABGame
import com.wagerproof.core.models.NFLPrediction
import com.wagerproof.core.models.serialization.WagerproofJson
import kotlinx.serialization.decodeFromString

/** Frozen offline fixtures; dates intentionally stay in a future season. */
internal object VisualFixtures {
    val nfl: NFLPrediction = WagerproofJson.decodeFromString(
        """{
          "id":"visual-nfl","game_id":"visual-nfl","away_team":"Buffalo Bills","home_team":"Kansas City Chiefs",
          "away_ab":"BUF","home_ab":"KC","gameday":"2027-10-17","kickoff":"2027-10-17T20:25:00Z",
          "game_date":"2027-10-17","game_time":"4:25 PM","unique_id":"visual-nfl","training_key":"visual-nfl",
          "away_ml":115,"home_ml":-135,"away_spread":2.5,"home_spread":-2.5,"over_line":49.5,
          "fg_spread_close":-2.5,"fg_total_close":49.5,"fg_ml_home_close":-135,"fg_ml_away_close":115,
          "home_away_ml_prob":0.61,"home_away_spread_cover_prob":0.66,"ou_result_prob":0.58,
          "pred_total":51.8,"run_id":"visual-fixture","season":2027,"week":7
        }""",
    )

    val cfb: CFBPrediction = WagerproofJson.decodeFromString(
        """{
          "id":"visual-cfb","game_id":"visual-cfb","away_team":"Texas","home_team":"Georgia",
          "game_date":"2027-10-16","game_time":"7:30 PM","kickoff":"2027-10-16T23:30:00Z",
          "training_key":"visual-cfb","unique_id":"visual-cfb","away_ml":185,"home_ml":-220,
          "away_spread":5.5,"home_spread":-5.5,"over_line":52.5,"fg_spread_close":-5.5,
          "fg_total_close":52.5,"fg_pred_margin":8.1,"fg_pred_total":55.4,"fg_spread_pick":"HOME",
          "fg_home_cover_prob":0.69,"fg_home_win_prob":0.74,"run_id":"visual-fixture",
          "conviction_tier":"strong","mammoth":false,"flags":[]
        }""",
    )

    val nba = NBAGame(
        id = "visual-nba", gameId = 9001, awayTeam = "Boston Celtics", homeTeam = "Los Angeles Lakers",
        awayAbbr = "BOS", homeAbbr = "LAL", homeMl = -125, awayMl = 108,
        homeSpread = -2.5, awaySpread = 2.5, overLine = 224.5,
        gameDate = "2027-02-14", gameTime = "8:30 PM", trainingKey = "visual-nba", uniqueId = "visual-nba",
        homeAwayMlProb = 0.59, homeAwaySpreadCoverProb = 0.64, ouResultProb = 0.57,
        homeScorePred = 116.8, awayScorePred = 111.9, modelFairHomeSpread = -4.9, modelFairTotal = 228.7,
    )

    val ncaab = NCAABGame(
        id = "visual-ncaab", gameId = 9002, awayTeam = "North Carolina", homeTeam = "Duke",
        homeMl = -180, awayMl = 155, homeSpread = -4.0, awaySpread = 4.0, overLine = 151.5,
        gameDate = "2027-02-15", gameTime = "7:00 PM", trainingKey = "visual-ncaab", uniqueId = "visual-ncaab",
        homeRanking = 3, awayRanking = 8, conferenceGame = true,
        homeAwayMlProb = 0.65, homeAwaySpreadCoverProb = 0.68, ouResultProb = 0.55,
        predHomeMargin = 7.2, predTotalPoints = 154.1, homeScorePred = 80.7, awayScorePred = 73.4,
        modelFairHomeSpread = -7.2, homeTeamAbbrev = "DUKE", awayTeamAbbrev = "UNC",
    )

    val mlb = MLBGame(
        id = "visual-mlb", gamePk = 9003, officialDate = "2027-06-12", gameTimeEt = "7:05 PM",
        awayTeamName = "New York Yankees", homeTeamName = "Boston Red Sox",
        awayTeam = "New York Yankees", homeTeam = "Boston Red Sox",
        awayAbbr = "NYY", homeAbbr = "BOS", awayMl = 105, homeMl = -120,
        awaySpread = 1.5, homeSpread = -1.5, totalLine = 8.5,
        mlHomeWinProb = 0.58, mlAwayWinProb = 0.42, homeMlEdgePct = 5.2,
        ouEdge = 1.1, ouDirection = "OVER", ouFairTotal = 9.6, ouStrongSignal = true,
        homeSpName = "Garrett Crochet", awaySpName = "Gerrit Cole",
        homeSpConfirmed = true, awaySpConfirmed = true,
        temperatureF = 72.0, windSpeedMph = 8.0, sky = "Clear", venueName = "Fenway Park",
    )

    val nflPropSelection: NFLPlayerPropSelection
        get() = NFLPropFeed.items(PropsFixtures.nflBoard).first().selection
}
