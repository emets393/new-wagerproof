# Git Sync Command

Safely sync the current branch with remote origin by fetching, merging, and pushing changes.

## Steps to perform:

1. **Check current state**
   - Run `git status` to verify working tree is clean
   - If there are uncommitted changes, warn the user and stop

2. **Fetch remote changes**
   - Run `git fetch origin`
   - Check if there are any incoming changes with `git log --oneline HEAD..origin/$(git branch --show-current)`

3. **Merge remote changes**
   - If there are incoming changes, merge them: `git merge origin/$(git branch --show-current) -m "Merge remote changes from origin"`
   - If merge conflicts occur, list the conflicting files and stop for user intervention

4. **Push local changes**
   - Push to remote: `git push origin $(git branch --show-current)`
   - Verify push was successful

5. **Report summary**
   - Show how many commits were pulled/pushed
   - Show final `git status` to confirm sync is complete

## Safety checks:
- Never force push
- Never push to main/master without explicit confirmation if there are conflicts
- Always verify working tree is clean before starting
- Stop immediately if merge conflicts are detected
