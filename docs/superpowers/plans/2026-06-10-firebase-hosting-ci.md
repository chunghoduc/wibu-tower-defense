# Firebase Hosting CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-deploy the static `dist/` build to free Firebase Hosting — every push to `main` ships to production, every PR gets a temporary preview URL.

**Architecture:** Two committed config files (`firebase.json`, `.firebaserc`) plus two GitHub Actions workflows that build + typecheck + test, then deploy via the official `FirebaseExtended/action-hosting-deploy` action. Auth is a Hosting-scoped service-account key stored as a GitHub repo secret. Spark (free) plan, no billing.

**Tech Stack:** Firebase Hosting, GitHub Actions, `firebase-tools` (CLI, run via `npx`), Node 20, Vite, Vitest, TypeScript.

> **Note on TDD:** This plan produces config/YAML, not application code, so there are no unit tests to write first. The equivalent discipline here is *verification by observed deploy behavior* (Task 7), and locally validating YAML/JSON before commit. Each task still ends in a commit.

> **Placeholder convention:** `PROJECT_ID` below means the real Firebase project ID captured in Task 1 (e.g. `wibu-tower-defense` or `wibu-tower-defense-xxxxx` if that name was taken). Replace every literal `PROJECT_ID` with the captured value when you reach the relevant task. The secret name `FIREBASE_SERVICE_ACCOUNT_WIBU_TOWER_DEFENSE` likewise must match what `firebase init` created — confirm its exact name in the repo's GitHub secrets (Settings → Secrets and variables → Actions).

---

## Task 1: One-time manual setup (USER performs — agent cannot log into Google)

**Files:** none committed in this task; it produces the `PROJECT_ID` and the GitHub secret that later tasks depend on.

- [ ] **Step 1: Create a free Firebase project**

Go to <https://console.firebase.google.com> → **Add project** → name it `wibu-tower-defense` (accept whatever final `PROJECT_ID` it assigns; note it down). Disable Google Analytics (not needed). Do **not** upgrade to Blaze — stay on the default **Spark** plan. No billing/credit card is requested.

- [ ] **Step 2: Log in with the Firebase CLI**

In the repo root, run (the `!`-prefix in Claude Code runs it in-session if you want the output captured):

```bash
npx -y firebase-tools login
```

Expected: a browser opens; after granting access the terminal prints `✔ Success! Logged in as <your-email>`.

- [ ] **Step 3: Connect the repo to GitHub Actions (creates the secret)**

```bash
npx -y firebase-tools init hosting:github
```

Answer the prompts:
- "Which Firebase project?" → select the `PROJECT_ID` from Step 1.
- "For which GitHub repository?" → `chunghoduc/wibu-tower-defense`.
- "Set up the workflow to run a build script before every deploy?" → **No** (we supply our own build steps in Tasks 4–5).
- "Set up automatic deployment to your site's live channel when a PR is merged?" → **Yes**, branch `main`.

Expected: it creates a service account, uploads a secret named like `FIREBASE_SERVICE_ACCOUNT_WIBU_TOWER_DEFENSE` to the GitHub repo, and writes `.github/workflows/firebase-hosting-merge.yml` and `firebase-hosting-pull-request.yml`. It may also create/overwrite `firebase.json` and `.firebaserc`.

- [ ] **Step 4: Capture the exact secret name and project ID**

In GitHub: repo → **Settings → Secrets and variables → Actions**. Confirm the secret name and record it. Record `PROJECT_ID`. These feed Tasks 2–5.

- [ ] **Step 5: Commit whatever `firebase init` generated, as a baseline**

```bash
git checkout -b ci/firebase-hosting
git add -A
git commit -m "chore(ci): baseline firebase init hosting:github output"
```

(We refine these files in the following tasks. Committing first gives a clean diff for the refinements.)

---

## Task 2: Hosting config — `firebase.json`

**Files:**
- Create/replace: `firebase.json`

- [ ] **Step 1: Write `firebase.json`**

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**/*.@(js|css|woff2|png|jpg|jpeg|gif|svg|webp|mp3|ogg|wav)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      },
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      }
    ]
  }
}
```

Rationale: Vite emits content-hashed asset filenames, so they are safe to cache for a year; `index.html` is never cached so a new deploy is picked up immediately. No SPA rewrite — assets are real files and the game is a single `index.html`.

- [ ] **Step 2: Validate the JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8')); console.log('valid JSON')"
```
Expected: `valid JSON`

- [ ] **Step 3: Verify the build output dir matches `public`**

Run:
```bash
npm run build && ls dist/index.html
```
Expected: build succeeds and `dist/index.html` exists (confirms `public: "dist"` is correct).

- [ ] **Step 4: Commit**

```bash
git add firebase.json
git commit -m "chore(ci): firebase hosting config (dist + cache headers)"
```

---

## Task 3: Project alias — `.firebaserc`

**Files:**
- Create/replace: `.firebaserc`

- [ ] **Step 1: Write `.firebaserc`** (replace `PROJECT_ID` with the real value from Task 1)

```json
{
  "projects": {
    "default": "PROJECT_ID"
  }
}
```

- [ ] **Step 2: Validate**

Run:
```bash
node -e "const c=require('./.firebaserc'); if(!c.projects.default||c.projects.default==='PROJECT_ID'){throw new Error('PROJECT_ID not substituted')} console.log('ok:',c.projects.default)"
```
Expected: `ok: <your real project id>` (fails loudly if the placeholder was left in).

- [ ] **Step 3: Commit**

```bash
git add .firebaserc
git commit -m "chore(ci): pin firebase project id"
```

---

## Task 4: Production deploy workflow — `deploy.yml`

**Files:**
- Create: `.github/workflows/deploy.yml`
- Delete: `.github/workflows/firebase-hosting-merge.yml` (the auto-generated one this replaces)

- [ ] **Step 1: Write `.github/workflows/deploy.yml`** (replace `FIREBASE_SERVICE_ACCOUNT_WIBU_TOWER_DEFENSE` and `PROJECT_ID` with the real values from Task 1)

```yaml
name: Deploy to Firebase Hosting (live)

on:
  push:
    branches: [main]

# Cancel an in-progress live deploy if a newer push arrives.
concurrency:
  group: firebase-live
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Typecheck + build
        run: npm run build

      - name: Tests
        run: npm test

      - name: Deploy to live channel
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_WIBU_TOWER_DEFENSE }}
          channelId: live
          projectId: PROJECT_ID
```

- [ ] **Step 2: Delete the auto-generated merge workflow**

```bash
git rm .github/workflows/firebase-hosting-merge.yml
```
(If `firebase init` named it differently, `git rm` that file instead; run `ls .github/workflows/` to check.)

- [ ] **Step 3: Lint the YAML**

Run:
```bash
npx -y js-yaml .github/workflows/deploy.yml > /dev/null && echo "valid YAML"
```
Expected: `valid YAML`

- [ ] **Step 4: Confirm no leftover placeholders**

Run:
```bash
! grep -n "PROJECT_ID" .github/workflows/deploy.yml && echo "no placeholders"
```
Expected: `no placeholders` (the `grep` must find nothing — the real project id should be substituted).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy to firebase live on push to main"
```

---

## Task 5: PR preview workflow — `preview.yml`

**Files:**
- Create: `.github/workflows/preview.yml`
- Delete: `.github/workflows/firebase-hosting-pull-request.yml` (the auto-generated one this replaces)

- [ ] **Step 1: Write `.github/workflows/preview.yml`** (replace `FIREBASE_SERVICE_ACCOUNT_WIBU_TOWER_DEFENSE` and `PROJECT_ID` with the real values from Task 1)

```yaml
name: Preview deploy (PR)

on:
  pull_request:
    branches: [main]

concurrency:
  group: firebase-preview-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  build-and-preview:
    runs-on: ubuntu-latest
    # Secrets are unavailable to PRs opened from forks; skip those.
    if: ${{ github.event.pull_request.head.repo.full_name == github.repository }}
    permissions:
      checks: write
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Typecheck + build
        run: npm run build

      - name: Tests
        run: npm test

      - name: Deploy preview channel
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_WIBU_TOWER_DEFENSE }}
          projectId: PROJECT_ID
          expires: 7d
```

(Omitting `channelId` makes the action create/update a per-PR preview channel and comment its URL on the PR. `expires: 7d` auto-cleans stale previews.)

- [ ] **Step 2: Delete the auto-generated PR workflow**

```bash
git rm .github/workflows/firebase-hosting-pull-request.yml
```
(Check the real filename with `ls .github/workflows/` first.)

- [ ] **Step 3: Lint the YAML**

Run:
```bash
npx -y js-yaml .github/workflows/preview.yml > /dev/null && echo "valid YAML"
```
Expected: `valid YAML`

- [ ] **Step 4: Confirm no leftover placeholders**

Run:
```bash
! grep -n "PROJECT_ID" .github/workflows/preview.yml && echo "no placeholders"
```
Expected: `no placeholders`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/preview.yml
git commit -m "ci: per-PR firebase preview deploys"
```

---

## Task 6: Ignore Firebase local artifacts + document deploy

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Append Firebase artifacts to `.gitignore`**

Add these lines to `.gitignore` (so local CLI runs don't leave junk staged):

```gitignore
# Firebase CLI local artifacts
.firebase/
firebase-debug.log*
firebase-debug.*.log*
```

- [ ] **Step 2: Add a Deployment section to `README.md`**

Add this section near the end of `README.md` (replace `PROJECT_ID` with the real value):

```markdown
## Deployment

The game auto-deploys to Firebase Hosting (free Spark plan) via GitHub Actions:

- **Push to `main`** → builds, typechecks, tests, and deploys to production:
  <https://PROJECT_ID.web.app>
- **Open a PR** → deploys a temporary preview channel; the bot comments the URL
  on the PR (previews expire after 7 days).

CI fails before deploying if `npm run build` or `npm test` fails, so broken code
never reaches production. Auth uses the `FIREBASE_SERVICE_ACCOUNT_*` repo secret;
no manual deploy steps are needed.
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore README.md
git commit -m "docs(ci): document firebase deploy + ignore CLI artifacts"
```

---

## Task 7: End-to-end verification (observed behavior, not file existence)

**Files:** none — this proves the pipeline works.

- [ ] **Step 1: Push the branch and open a PR**

```bash
git push -u origin ci/firebase-hosting
gh pr create --fill --base main
```

- [ ] **Step 2: Watch the preview workflow**

```bash
gh pr checks --watch
```
Expected: `Preview deploy (PR)` finishes successfully (green).

- [ ] **Step 3: Open the preview URL**

Find the bot comment on the PR:
```bash
gh pr view --comments | grep -i "web.app"
```
Open the printed URL in a browser. Expected: the game loads and is playable.

- [ ] **Step 4: Merge and watch the live deploy**

```bash
gh pr merge --squash --delete-branch
gh run watch $(gh run list --workflow=deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')
```
Expected: `Deploy to Firebase Hosting (live)` succeeds (green).

- [ ] **Step 5: Confirm production serves the build**

Open <https://PROJECT_ID.web.app> (and verify `https://PROJECT_ID.firebaseapp.com` also works). Expected: the live game loads. **Deployment automation is now complete.**

---

## Self-Review Notes

- **Spec coverage:** firebase.json (Task 2), .firebaserc (Task 3), deploy.yml live-on-main with build/test gate (Task 4), preview.yml PR previews + 7d expiry + fork-skip (Task 5), service-account-secret auth (referenced in Tasks 4–5, created in Task 1), free `.web.app` URL (Tasks 6–7), verification by observed deploy (Task 7). All design sections mapped.
- **Out-of-scope items** (custom domain, backend, $300 credit, Blaze, WIF) correctly absent.
- **Placeholder convention** is explicit and every task that embeds `PROJECT_ID` or the secret name has a guard step (`grep`/`node` check) that fails loudly if a placeholder survives.
- **Name consistency:** workflow files `deploy.yml`/`preview.yml`, secret `FIREBASE_SERVICE_ACCOUNT_WIBU_TOWER_DEFENSE`, action `FirebaseExtended/action-hosting-deploy@v0` used identically across tasks.
