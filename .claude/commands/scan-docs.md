---
description: Scan repo for markdown files and check if they need integration into .claude/docs
allowed-tools: Glob(*), Read(*), Grep(*)
---

# Scan and Validate Documentation

Scan the repository for markdown files and check if they should be integrated into the `.claude/docs` codebase documentation.

## Task

1. **Find all markdown files** in the root directory and any `docs` folders (excluding `node_modules`, `.git`, `archive`, and already-processed `.claude/docs`):
   - Root level `.md` files
   - Any `docs/` or `documentation/` folders
   - `wagerproof-mobile/` root level docs

2. **For each file found**, analyze:
   - Is the content still relevant and accurate?
   - Does it describe a feature, architecture, or process that should be in `.claude/docs`?
   - Is it a temporary fix log, debugging notes, or outdated changelog?

3. **Categorize each file** into one of:
   - **INTEGRATE**: Should be merged into existing `.claude/docs` file
   - **NEW DOC**: Needs a new documentation file in `.claude/docs`
   - **ARCHIVE**: Outdated or no longer relevant - move to `markdown_LLM_planning_files/archive/`
   - **KEEP**: Valid standalone doc (like README.md) that should stay where it is

4. **Output a report** with:
   - List of files found with their category and reasoning
   - Recommended actions for each
   - Summary of documentation coverage gaps

## Current `.claude/docs` Structure

For reference, these docs already exist:
- `00_CODEBASE_OVERVIEW.md` - Architecture, tech stack, directory structure
- `01_buildship_api.md` - BuildShip endpoints, streaming
- `02_chat_wagerbot.md` - AI chat, Responses API
- `03_payments_billing.md` - RevenueCat, Stripe
- `04_sports_predictions.md` - Database tables, predictions
- `05_ui_design_theme.md` - Theming, colors, animations
- `06_auth_seo_deploy.md` - Auth, SEO, deployment
- `07_mobile_features.md` - Mobile-specific features
- `08_database_caching.md` - Supabase, caching, edge functions

## Instructions

- Use the Glob tool to find `.md` files
- Use the Read tool to examine file contents
- Cross-reference with existing `.claude/docs` to identify gaps or duplicates
- Verify any technical claims against the actual codebase before recommending integration
- Do NOT make changes automatically - only produce the report for user review

## Output Format

```
## Documentation Scan Report

### Files Found: X

### Category: INTEGRATE
| File | Target Doc | Reason |
|------|------------|--------|
| ... | ... | ... |

### Category: NEW DOC
| File | Suggested Name | Reason |
|------|----------------|--------|
| ... | ... | ... |

### Category: ARCHIVE
| File | Reason |
|------|--------|
| ... | ... |

### Category: KEEP
| File | Reason |
|------|--------|
| ... | ... |

### Documentation Gaps Identified
- ...

### Recommended Actions
1. ...
```
