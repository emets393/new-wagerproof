Perform a documentation health check on this codebase. Work through each step completely.

## Step 1: Scan all docs against the code

Find every .md file in the repo (excluding node_modules, ios/Pods, .expo, CHANGELOG.md, LICENSE.md). For each one:

- Check if files, functions, routes, services, or modules it references still exist
- Check if env vars, config, or dependencies it describes are still accurate
- Check if the structure or architecture it describes matches the current code
- Flag anything that references code or behavior that no longer exists or has changed

Classify each doc as:
- **OK** — Accurate, no issues
- **STALE** — References real things but details are wrong or outdated
- **ORPHANED** — References code/features/systems that no longer exist
- **REDUNDANT** — Duplicates info in another doc

## Step 2: Check recent commits for undocumented changes

Look at the last 20 commits (use `git log --oneline -20` and `git diff` against the base). For each commit that changed code:

- Did it add/remove/rename files that are referenced in docs?
- Did it change behavior, APIs, config, or env vars that docs describe?
- Did it add new features or systems that should have docs but don't?

Identify any docs that should have been updated but weren't.

## Step 3: Fix what you can, ask about the rest

- For STALE docs: Read the current source code and update the doc to match reality
- For ORPHANED docs: Ask me before deleting — show me which doc and what it references that's gone
- For REDUNDANT docs: Ask me which one to keep
- For undocumented recent changes: Add documentation where needed, following the project's existing doc structure

## Step 4: Show me a summary

Present a table with: File | Status | Action Taken

Then list anything that needs my input.

## Ground Rules
- Never fabricate content — read the actual code before writing docs
- Write docs that describe what IS, not what was or should be
- Follow the documentation standards in CLAUDE.md
- Update DOCS.md if you add or remove any documentation files
