import { describe, expect, it } from "vitest";
import {
  MAX_LEGS,
  PARLAY_DEFAULTS,
  calculateParlay,
  decimalToAmerican,
  formatAmerican,
  formatMoney,
  formatSignedMoney,
  legStatsText,
  noVigProbability,
  parlayDisplay,
  parseOdds,
  parseStake,
} from "./parlay-math.js";

type Leg = { odds: string; opposite?: string; void?: boolean };
const run = (legs: Leg[], stake = "10", format = "auto") =>
  calculateParlay({ legs: legs.map((leg) => ({ opposite: "", void: false, ...leg })), stake, format });

// -110 is exactly 21/11 in decimal.
const MINUS_110 = 21 / 11;

describe("parseOdds", () => {
  it("auto-detects American, decimal and fractional odds", () => {
    expect(parseOdds("-110")).toMatchObject({ ok: true, format: "american" });
    expect(parseOdds("-110").decimal).toBeCloseTo(MINUS_110, 12);
    expect(parseOdds("+150")).toMatchObject({ ok: true, decimal: 2.5, format: "american" });
    expect(parseOdds("150")).toMatchObject({ ok: true, decimal: 2.5, format: "american" });
    expect(parseOdds("2.50")).toMatchObject({ ok: true, decimal: 2.5, format: "decimal" });
    expect(parseOdds("5/2")).toMatchObject({ ok: true, decimal: 3.5, format: "fractional" });
    expect(parseOdds("10/11").decimal).toBeCloseTo(MINUS_110, 12);
    expect(parseOdds("evens")).toMatchObject({ ok: true, decimal: 2 });
    expect(parseOdds(" −110 ").decimal).toBeCloseTo(MINUS_110, 12);
  });

  it("honours an explicit format", () => {
    expect(parseOdds("250", "american").decimal).toBe(3.5);
    expect(parseOdds("1.5", "decimal").decimal).toBe(1.5);
    expect(parseOdds("1.5", "american").ok).toBe(false);
    expect(parseOdds("5/2", "decimal").ok).toBe(false);
  });

  it("rejects bad input with a message", () => {
    for (const bad of ["", "abc", "-99", "+50", "1", "0.9", "0/5", "5/0", "--110"]) {
      const result = parseOdds(bad);
      expect(result.ok, bad).toBe(false);
      expect(result.error, bad).toMatch(/\w/);
    }
    expect(parseOdds("").empty).toBe(true);
  });
});

describe("conversions", () => {
  it("converts decimal back to whole American odds", () => {
    expect(decimalToAmerican(2.5)).toBe(150);
    expect(decimalToAmerican(MINUS_110)).toBe(-110);
    expect(decimalToAmerican(1.8)).toBe(-125);
    expect(decimalToAmerican(2)).toBe(100);
    expect(decimalToAmerican(1)).toBeNull();
    expect(formatAmerican(3.5)).toBe("+250");
    expect(formatAmerican(1.8)).toBe("-125");
  });

  it("formats money to the cent", () => {
    expect(formatMoney(91.11570247933885)).toBe("$91.12");
    expect(formatMoney(69.57926371149513)).toBe("$69.58");
    expect(formatMoney(1234567.891)).toBe("$1,234,567.89");
    expect(formatSignedMoney(-1.1506)).toBe("-$1.15");
    expect(formatSignedMoney(2.5)).toBe("+$2.50");
  });

  it("removes the vig proportionally", () => {
    expect(noVigProbability(MINUS_110, MINUS_110)).toBeCloseTo(0.5, 12);
    // +150 against -170: 0.4 / (0.4 + 170/270)
    expect(noVigProbability(2.5, 1 + 100 / 170)).toBeCloseTo(0.4 / (0.4 + 170 / 270), 12);
  });

  it("parses stakes", () => {
    expect(parseStake("$1,000.50")).toMatchObject({ ok: true, value: 1000.5 });
    expect(parseStake("0").ok).toBe(false);
    expect(parseStake("-5").ok).toBe(false);
    expect(parseStake("ten").ok).toBe(false);
  });
});

describe("calculateParlay known values", () => {
  it("prices the default -110/-110/+150 example", () => {
    const result = run(PARLAY_DEFAULTS.legs);
    const exact = MINUS_110 * MINUS_110 * 2.5; // 9.111570...
    expect(result.decimal).toBeCloseTo(exact, 12);
    expect(result.decimal).toBeCloseTo(9.11157, 5);
    expect(result.american).toBe("+811");
    expect(result.payout).toBeCloseTo(91.1157, 4);
    expect(result.implied).toBeCloseTo(0.1097506, 7);
    const display = parlayDisplay(result);
    expect(display).toMatchObject({ payout: "$91.12", profit: "$81.12", american: "+811", decimal: "9.1116", implied: "10.98%" });
    expect(display.impliedSentence).toBe("The book's price implies this parlay hits 10.98% of the time, about 1 in 9.1.");
    expect(result.fair).toBeUndefined();
  });

  it("prices three -110 legs", () => {
    const result = run([{ odds: "-110" }, { odds: "-110" }, { odds: "-110" }]);
    expect(result.decimal).toBeCloseTo(9261 / 1331, 12); // 6.957926...
    expect(parlayDisplay(result)).toMatchObject({ payout: "$69.58", profit: "$59.58", american: "+596" });
  });

  it("shows how the vig compounds on -110 coin flips", () => {
    const two = run([{ odds: "-110", opposite: "-110" }, { odds: "-110", opposite: "-110" }]);
    expect(two.decimal).toBeCloseTo(441 / 121, 12); // 3.644628...
    expect(two.american).toBe("+264");
    expect(two.fair?.probability).toBeCloseTo(0.25, 12);
    expect(two.fair?.decimal).toBeCloseTo(4, 12);
    expect(two.fair?.american).toBe("+300");
    expect(two.fair?.houseEdge).toBeCloseTo(1 - 0.25 * (441 / 121), 12);
    expect(parlayDisplay(two).fair).toMatchObject({ probability: "25.00%", american: "+300", fairPayout: "$40.00", expectedValue: "-$0.89", houseEdge: "8.88%" });

    const table = [1, 2, 3, 4].map((n) => parlayDisplay(run(Array.from({ length: n }, () => ({ odds: "-110", opposite: "-110" })))));
    expect(table.map((row) => [row.american, row.fair?.american, row.payout, row.fair?.fairPayout, row.fair?.houseEdge])).toEqual([
      ["-110", "+100", "$19.09", "$20.00", "4.55%"],
      ["+264", "+300", "$36.45", "$40.00", "8.88%"],
      ["+596", "+700", "$69.58", "$80.00", "13.03%"],
      ["+1228", "+1500", "$132.83", "$160.00", "16.98%"],
    ]);
    expect(table[3].fair?.expectedValue).toBe("-$1.70");
  });

  it("removes the vig from the default example", () => {
    const result = run([{ odds: "-110", opposite: "-110" }, { odds: "-110", opposite: "-110" }, { odds: "+150", opposite: "-170" }]);
    const fairThird = 0.4 / (0.4 + 170 / 270);
    expect(result.fair?.probability).toBeCloseTo(0.25 * fairThird, 12);
    expect(parlayDisplay(result).fair).toEqual({
      probability: "9.71%",
      american: "+930",
      decimal: "10.2963",
      fairPayout: "$102.96",
      expectedValue: "-$1.15",
      houseEdge: "11.51%",
    });
    expect(legStatsText(result.legs[2])).toBe("2.5000 decimal · +150 American · 40.00% implied · 38.85% no-vig");
  });

  it("needs other-side odds on every active leg for the fair parlay", () => {
    const result = run([{ odds: "-110", opposite: "-110" }, { odds: "-110" }]);
    expect(result.fair).toBeUndefined();
    expect(parlayDisplay(result).fairMessage).toMatch(/1 of 2 active legs/);
  });

  it("drops pushed or voided legs", () => {
    const result = run([{ odds: "-110" }, { odds: "-110", void: true }, { odds: "+150" }]);
    expect(result.activeCount).toBe(2);
    expect(result.decimal).toBeCloseTo(MINUS_110 * 2.5, 12);
    expect(parlayDisplay(result)).toMatchObject({ payout: "$47.73", american: "+377" });
    expect(parlayDisplay(result).status).toMatch(/1 leg removed/);
    // a void leg with bad odds does not block the calculation
    expect(run([{ odds: "-110" }, { odds: "junk", void: true }, { odds: "+150" }]).ready).toBe(true);
  });

  it("settles one remaining leg as a straight bet and refunds an all-void ticket", () => {
    const single = run([{ odds: "+150" }, { odds: "-110", void: true }]);
    expect(single.status).toBe("single");
    expect(parlayDisplay(single).payout).toBe("$25.00");
    const refund = run([{ odds: "+150", void: true }, { odds: "-110", void: true }]);
    expect(refund.status).toBe("all-void");
    expect(parlayDisplay(refund)).toMatchObject({ payout: "$10.00", profit: "$0.00" });
  });

  it("blocks totals on invalid input with a clear status", () => {
    const bad = run([{ odds: "-50" }, { odds: "+150" }]);
    expect(bad.ready).toBe(false);
    expect(parlayDisplay(bad)).toMatchObject({ payout: "–", status: "Fix the highlighted odds to see the payout." });
    expect(parlayDisplay(run([{ odds: "" }, { odds: "+150" }])).status).toMatch(/Enter odds for every leg/);
    expect(parlayDisplay(run([{ odds: "-110" }, { odds: "+150" }], "abc")).status).toBe("Fix the stake to see the payout.");
  });

  it("handles twelve legs and mixed formats", () => {
    const legs = Array.from({ length: MAX_LEGS }, (_, index) => ({ odds: ["-110", "2.50", "5/2"][index % 3] }));
    const result = run(legs, "1");
    expect(result.decimal).toBeCloseTo((MINUS_110 * 2.5 * 3.5) ** 4, 6);
    expect(result.american).toBe(formatAmerican(result.decimal));
  });
});
