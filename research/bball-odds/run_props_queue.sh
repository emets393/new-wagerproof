#!/bin/zsh
# Wait for the classifier run to release its cores, then run the two remaining prop
# methods back to back. Sequential on purpose: 8 cores, and three boosting jobs
# contending just makes all three slow without finishing any of them sooner.
cd "$(dirname "$0")"
while kill -0 4006 2>/dev/null; do sleep 20; done
export OMP_NUM_THREADS=4 OPENBLAS_NUM_THREADS=4 MKL_NUM_THREADS=4
python3 -u -W ignore nba_props_count_model.py > nba_props_count_stdout.log 2>&1
python3 -u -W ignore nba_props_stack.py       > nba_props_stack_stdout.log 2>&1
python3 -u -W ignore nba_props_ladder.py      > nba_props_ladder_stdout.log 2>&1
echo "QUEUE DONE"
