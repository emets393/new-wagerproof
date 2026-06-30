# Conductor setup for WagerProof

How Conductor gets each workspace ready to run — secrets and dependencies — and
how to operate it.

## The problem

Every Conductor workspace is a separate git worktree. Two things a worktree needs
are gitignored, so a freshly created workspace starts without them:

- **`.env` files** (they hold secrets). Anything that reads them fails — most
  visibly the `agents-v3` Trigger.dev worker, which dies immediately with
  `supabaseUrl is required` when `agents-v3/.env` is missing.
- **`node_modules`**. npm tooling can't run until deps are installed — e.g.
  `agents-v3`'s `npm run dev` / `npx trigger.dev dev` can't resolve the
  Trigger.dev CLI.

## How it works

`.conductor/settings.toml` runs two scripts on every new workspace (Conductor's
`scripts.setup` hook), chained:

1. **`scripts/conductor-setup.sh`** — copies the canonical `.env` files from a
   single **secret source** into the new workspace.
2. **`scripts/conductor-deps.sh`** — `npm install`s the workspace's node projects
   (the `NPM_DIRS` manifest; currently `agents-v3`) so `npm run dev` works out of
   the box. Idempotent: a dir whose `node_modules` already exists is skipped, and
   an install failure (e.g. offline) warns without aborting setup.

Secrets never enter git:

- Each destination must be gitignored — the script refuses to write any path
  that `git check-ignore` does not confirm as ignored.
- Copied files are `chmod 600`.
- The committed files here contain **no secret values** — only the script,
  settings, and `.env.example` templates.

### Files materialized

Driven by the `ENV_FILES` manifest at the top of `scripts/conductor-setup.sh`:

| Path             | Used by                                    | Template            |
| ---------------- | ------------------------------------------ | ------------------- |
| `.env`           | Web app (Vite) — `VITE_*` keys             | `.env.example`      |
| `agents-v3/.env` | agents-v3 Trigger.dev worker (`npm run dev`) | `agents-v3/.env.example` |

To add another env file: add its relative path to `ENV_FILES` and commit a
matching `<path>.example` template next to it.

## One-time setup (per machine)

Pick **one** secret source and fill in the canonical files there once. The
script resolves the source in this order (first match wins, per file):

1. **`$WAGERPROOF_SECRETS_DIR`** — keep secrets fully outside any checkout
   (recommended). Mirror the repo layout inside it:

   ```bash
   mkdir -p ~/.config/wagerproof/agents-v3
   cp .env.example            ~/.config/wagerproof/.env             # then edit
   cp agents-v3/.env.example  ~/.config/wagerproof/agents-v3/.env   # then edit
   ```

   Then export `WAGERPROOF_SECRETS_DIR=~/.config/wagerproof` for Conductor's
   shell (e.g. in `~/.zshrc`).

2. **The root checkout** (default, no extra config) — fill the env files in the
   repository's main directory (`$CONDUCTOR_ROOT_PATH`). Every workspace copies
   them from there:

   ```bash
   # in the main checkout (not a workspace)
   cp agents-v3/.env.example agents-v3/.env   # then edit in your secrets
   ```

After that, every new workspace is provisioned automatically — no per-workspace
copying.

## Re-provisioning an existing workspace

Both scripts are safe to run any time (idempotent). Workspaces created before
this setup existed won't have run them automatically — run them once by hand:

```bash
bash scripts/conductor-setup.sh   # .env files
bash scripts/conductor-deps.sh    # node_modules (agents-v3)
```

If a secret is missing in the source, `conductor-setup.sh` warns and continues
(the workspace is still usable for code work — you just can't run the worker
until the secret exists). `conductor-deps.sh` skips any dir that already has
`node_modules`; force a fresh install with `cd agents-v3 && npm install`.

## Production note

Production secrets are **not** sourced from these local files. The `agents-v3`
worker reads its env from Trigger.dev Cloud (Project → Environment variables),
and the `trigger-v3-run` edge function reads `TRIGGER_SECRET_KEY` from Supabase
Edge secrets. Local `.env` files only power local `trigger.dev dev` runs and the
local web app. See `agents-v3/README.md`.
