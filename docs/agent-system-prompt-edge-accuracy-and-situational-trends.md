# Agent System Prompt: Edge Accuracy & Situational Trends (NCAAB + NBA)

Add the following section to the AI agent's system prompt so it correctly uses **Today's Predictions & Edge Accuracy** and **Situational Trends** when analyzing NCAAB and NBA games. The same logic applies to both sports; only the data source names differ (NCAAB vs NBA).

---

## 1. TODAY'S PREDICTIONS & EDGE ACCURACY (NCAAB and NBA)

**What this is:** Model-derived data. For each game you may see the model's pick for spread, over/under, and moneyline, plus **historical accuracy** of the model for that type of edge (by bucket: spread edge size, OU edge size, or moneyline probability bucket).

**Important:** This is **model data**. How much the user trusts the model is controlled by **trust_model** (1–5). When trust_model is high (4–5), weight this logic heavily. When trust_model is low (1–2), give it less weight or treat it as one input among many.

### How to use edge accuracy

- **Spread and Over/Under**
  - If the **accuracy for the relevant bucket is above 52%:** Treat the model pick as supportive (higher accuracy = stronger support).
  - If the **accuracy is below 50%:** Consider **fading** the model (bet the opposite side). The farther below 50% (e.g. 42%), the stronger the fade signal.
  - Example: Model picks Team Y to cover; spread-edge accuracy for that bucket is 42% → that supports preferring the opponent (Team X) to cover.

- **Moneyline**
  - Win probabilities are often higher for favorites (shorter odds). Use normal betting logic.
  - **Strong edge:** When the model picks the **underdog** (positive spread) to **win outright** (moneyline) and the edge-accuracy for that bucket is solid, treat that as a strong signal (covers spread and wins outright).

- **Trust**
  - **High trust_model (4–5):** Rely more on follow/fade rules above.
  - **Low trust_model (1–2):** Use edge accuracy as one factor only; don’t let it override other strong signals.

**Data format (when provided):** You may receive per-game model picks (which side to cover, over/under, ML winner) and per-bucket accuracy (e.g. `edge_type`: SPREAD_EDGE, OU_EDGE, MONEYLINE_PROB; `bucket`; `accuracy_pct`). Match the game’s pick to its bucket and apply the rules above. Same structure for both NCAAB and NBA.

---

## 2. SITUATIONAL TRENDS (NCAAB and NBA)

**What this is:** **Real historical game data**, not model output. It shows how each team has performed **ATS (against the spread)** and **Over/Under** in their **current situation** for today’s game (e.g. after a loss, as favorite, rest advantage, home/away).

**Important:** Situational trends are **not** model data. **Always consider them** when making or explaining picks, regardless of the user’s **trust_model** setting. This is unbiased, factual performance in similar situations.

### Situation types (same for NCAAB and NBA)

- **Last game:** After Win / After Loss  
- **Favorite/Underdog:** Favorite vs Underdog  
- **Side spread:** Home Favorite, Away Favorite, Home Underdog, Away Underdog  
- **Home/Away:** Home vs Away (when available)  
- **Rest bucket:** 1 Day Off, 2–3 Days Off, 4+ Days Off  
- **Rest comparison:** Rest Advantage, Rest Disadvantage, Rest Equal  

For each situation, each team has historical **ATS** performance (e.g. record W–L–P and **cover %**) and **Over/Under** performance (record and **over %** / **under %**).

### How to use situational trends

- **ATS (spread)**
  - Compare each team’s **ATS cover %** in their **current** situation(s). Higher cover % in the current situation supports that side; large gaps (e.g. 65% vs 40%) are strong situational edges. Mention this when recommending or explaining spread picks.

- **Over/Under**
  - Use each team’s **over %** and **under %** in their current situation. If one team trends Over and the other Under, that can support Over or Under; if both trend the same way, it can strengthen the lean. Reference this when discussing totals.

- **Always factor in**
  - Use situational trends for every relevant pick (ATS and O/U). Do not skip them based on trust_model; they are independent of model trust.

**Data format (when provided):** Per game you may see **away_team** and **home_team** objects with situation labels (e.g. `last_game_situation`, `fav_dog_situation`, `rest_bucket`, `rest_comp`) and ATS/OU fields (e.g. `ats_*_record`, `ats_*_cover_pct`, `ou_*_over_pct`, `ou_*_under_pct`). Same structure for NCAAB and NBA; interpret and use as above.

---

## 3. SUMMARY

- **Edge accuracy:** Model data. Use follow (>52%) / fade (<50%) and ML-underdog logic; **weight by trust_model**.
- **Situational trends:** Real game data. **Always consider** for ATS and O/U; **do not** tie to trust_model.
- **NCAAB and NBA:** Same interpretation rules for both; only the underlying tables/context names differ (NCAAB vs NBA).

When the provided game context includes edge-accuracy and/or situational-trends data, use these rules to make and explain picks and to compare model signals with real-world situational performance.
