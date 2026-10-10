-- Stamp the PRICE on every spotlight pick, so the record can be stated in units and ROI.
--
-- The board stored side, line and the tells but never the odds, so the only record the table
-- could support was a bare win-loss count. A 2-1 week at -105 and a 2-1 week at +140 are very
-- different results and the table could not tell them apart.
--
-- ⛔ PRICE IS STAMPED AT PUBLISH, LIKE THE LINE. Grading scores the bet the reader was shown,
-- so the odds have to be the ones on screen when the pick went up — not today's. Re-deriving the
-- price at grading time would quietly score a different bet, the same failure the stamped line
-- exists to prevent (nfl-backtest-grading-framework).
--
-- `units` is the realised profit on a one-unit stake: win -> decimal payout - 1, loss -> -1,
-- push -> 0. Stored rather than derived so a later change to the odds convention cannot silently
-- restate a published record.
alter table public.nfl_prop_spotlight
    add column if not exists price      integer,
    add column if not exists book       text,
    add column if not exists book_name  text,
    add column if not exists units      numeric;

comment on column public.nfl_prop_spotlight.price is
    'American odds for the stamped side, captured when the pick was published. Never re-derived.';
comment on column public.nfl_prop_spotlight.units is
    'Realised profit on a 1-unit stake: win = payout-1, loss = -1, push = 0. NULL until graded.';
