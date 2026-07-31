#!/bin/zsh
# The queue script was already running when the ladder step was added, so it holds the
# old inode and will never see that line. Chain it here instead.
cd "$(dirname "$0")"
while kill -0 5979 2>/dev/null; do sleep 30; done
export OMP_NUM_THREADS=4 OPENBLAS_NUM_THREADS=4 MKL_NUM_THREADS=4
python3 -u -W ignore nba_props_ladder.py > nba_props_ladder_stdout.log 2>&1
echo "LADDER DONE"
