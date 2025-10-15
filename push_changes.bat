@echo off
git add src/pages/NFLAnalytics.tsx
git add supabase/functions/filter-nfl-training-data/index.ts
git commit -m "Fix NFL Analytics range sliders - season 2018-2025, proper dual-handle sliders"
git push
pause
