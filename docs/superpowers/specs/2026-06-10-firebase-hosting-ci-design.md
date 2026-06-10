# Automated Firebase Hosting Deployment — Design

**Date:** 2026-06-10
**Status:** Approved, pending implementation plan

## Goal

Continuously deploy the web build to a free, indefinitely-hosted public URL with
zero manual steps after the initial one-time setup. Every push to `main` ships to
production; every pull request gets a temporary live preview URL.

## Why Firebase Hosting / Spark plan

The game is a fully static client-side bundle (Vite + Phaser + TypeScript →
`dist/`, no backend). Firebase Hosting is part of Google Cloud and is purpose-built
for static sites: global CDN, free SSL, custom-domain support, and the simplest
GitHub Actions integration.

The **Spark (free) plan is permanently free** within its quotas (10 GB stored
files, 360 MB/day egress) and requires **no billing account and no credit card** —
so no charge is ever possible. This is explicitly preferred over the $300 trial
credit, which expires after 90 days. The $300 credit / Blaze plan is held in
reserve for a future backend if ever needed.

**Quota headroom:** `dist/` is a few MB. The only realistic way to exceed
360 MB/day egress is going semi-viral (~70+ fresh visitors/day at a ~5 MB payload).
On Spark, exceeding the cap simply pauses serving until the next day — it never
auto-bills.

## Architecture / Data flow

```
push to main      ─► deploy.yml  ─► npm ci ─► tsc --noEmit + vitest ─► vite build ─► deploy LIVE    ─► <project>.web.app
open/update a PR   ─► preview.yml ─► npm ci ─► tsc --noEmit + vitest ─► vite build ─► deploy PREVIEW ─► bot comments temp URL on PR
```

A failing typecheck or test fails the job **before** the deploy step, so broken
code can never reach the live channel.

## Components

### 1. Repo config files (committed)

- **`firebase.json`** — Hosting config:
  - `public: "dist"`
  - `ignore`: `firebase.json`, dotfiles, `node_modules`
  - Cache headers: long `max-age, immutable` for Vite's content-hashed assets
    (`assets/**`); `no-cache` for `index.html` so new deploys are picked up
    immediately.
  - No SPA catch-all rewrite — the game is a single `index.html` and assets are
    real files served directly. (Revisit only if client-side routing is added.)
- **`.firebaserc`** — pins the Firebase project ID as the `default` alias so CI
  targets the right project without flags.

### 2. GitHub Actions workflows

- **`.github/workflows/deploy.yml`**
  - Trigger: `push` to `main`.
  - Steps: checkout → setup-node (Node 20, npm cache) → `npm ci` →
    `npm run build` (= `tsc --noEmit && vite build`) → `npm test` →
    `FirebaseExtended/action-hosting-deploy` with `channelId: live`.
  - `concurrency` group cancels superseded in-progress runs.
- **`.github/workflows/preview.yml`**
  - Trigger: `pull_request`.
  - Same build/test gate, then `action-hosting-deploy` with no `channelId`
    (auto preview channel) + `expires: 7d`. The action comments the preview URL
    on the PR.
  - Note: PRs from forks cannot read repo secrets, so fork preview deploys are
    skipped — acceptable for this repo (single-owner).

Both authenticate via the `FIREBASE_SERVICE_ACCOUNT_*` repo secret and reference
the project via `projectId`.

### 3. GitHub ↔ Google auth

A Hosting-scoped service-account key, generated once by
`firebase init hosting:github` and stored as a GitHub Actions secret
(`FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>`). Chosen over Workload Identity
Federation for simplicity; the key is scoped to Hosting deploys only.

## One-time manual setup (performed by the user)

These require a Google login and cannot be automated by the agent. A precise
copy-paste checklist will be produced:

1. Create a free Firebase project in the console (no billing / no card).
2. In the repo: `firebase login`, then `firebase init hosting:github` — this
   creates the service account, stores the GitHub secret, and connects the repo.
3. Agent then replaces the auto-generated workflow(s) with the tested-build
   versions described above and commits config.

## Verification (acceptance)

Not "the files exist" — observed behavior:

1. Open a throwaway PR → `preview.yml` goes green → preview URL loads the game.
2. Merge → `deploy.yml` goes green → `<project>.web.app` serves the new build.

## Out of scope

Custom domain, backend/database/auth, $300 credit, Blaze plan, Workload Identity
Federation.
