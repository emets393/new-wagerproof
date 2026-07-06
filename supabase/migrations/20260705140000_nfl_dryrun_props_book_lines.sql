-- Precomputed best-shop over/under closes for NFL dry-run player props.
-- Populated by research/nfl-extreme-outcomes/dryrun_wk12_props.py using the
-- same best_prop_pick() logic as Outliers trend cards.
ALTER TABLE nfl_dryrun_props
    ADD COLUMN IF NOT EXISTS best_over_book text,
    ADD COLUMN IF NOT EXISTS best_over_book_name text,
    ADD COLUMN IF NOT EXISTS best_over_book_logo text,
    ADD COLUMN IF NOT EXISTS best_over_line numeric,
    ADD COLUMN IF NOT EXISTS best_over_price numeric,
    ADD COLUMN IF NOT EXISTS best_under_book text,
    ADD COLUMN IF NOT EXISTS best_under_book_name text,
    ADD COLUMN IF NOT EXISTS best_under_book_logo text,
    ADD COLUMN IF NOT EXISTS best_under_line numeric,
    ADD COLUMN IF NOT EXISTS best_under_price numeric;

COMMENT ON COLUMN nfl_dryrun_props.best_over_book IS
    'Book key for the best over (or yes-ATD) shop at T-60 close.';
COMMENT ON COLUMN nfl_dryrun_props.best_under_book IS
    'Book key for the best under shop at T-60 close.';
