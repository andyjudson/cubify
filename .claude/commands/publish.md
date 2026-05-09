---
description: Bump cubify package versions, publish to GitHub Packages, and update cfop-app to deploy.
---

# /publish — Release cubify packages and update cfop-app

Bumps both packages to a new version, publishes to GitHub Packages, updates the cfop-app lock file, and pushes cfop to trigger a deploy.

## Usage

```
/publish <version>
```

Example: `/publish 1.0.1`

## Steps

Run these in order. Each step depends on the previous completing cleanly.

### 1. Bump, tag, and publish (cubify repo)

```bash
bash scripts/version-bump.sh <version>
git push && git push --tags
```

`version-bump.sh` updates both `packages/cubify/package.json` and `packages/cubify-react/package.json`, commits, and creates the tag. The tag push triggers `publish.yml` CI, which builds and publishes both packages to GitHub Packages and creates a GitHub Release.

### 2. Draft release notes

Run this to get commits since the previous tag:

```bash
git log $(git describe --tags --abbrev=0 HEAD^)..v<version> --oneline
```

Draft a short human-friendly release summary (≤300 words) in plain language — what changed and why it matters, not just a list of commit subjects. Format:

```
<one sentence overview of the release>

**Changes:**
- <what changed, phrased for a consumer of the library>
- ...
```

Show the draft to the user. Wait for approval, edits, or a correction. If the user provides their own text, check for typos and minor phrasing only — do not rewrite it.

**Wait for CI to go green** before proceeding — `npm install` in step 3 will fail if the package isn't live yet. Check: https://github.com/andyjudson/cubify/actions

Once CI is green and notes are approved, update the GitHub Release:

```bash
gh release edit v<version> --notes "<approved notes>" --repo andyjudson/cubify
```

### 3. Update cfop-app lock file (cfop repo)

```bash
cd /Users/Andy/Documents/TechLab/cfop/cfop-app
npm install @andyjudson/cubify@<version> @andyjudson/cubify-react@<version>
```

This rewrites `package-lock.json` to pin the new version. Requires `NPM_AUTH_TOKEN` set in the shell (`~/.zprofile`).

### 4. Push cfop to deploy

Commit the lock file update and push:

```bash
git add cfop-app/package-lock.json cfop-app/package.json
git commit -m "chore: bump cubify to v<version>"
git push
```

The push triggers `deploy.yml`, which runs `npm ci` against the updated lock file and deploys to GitHub Pages.

## Notes

- Published versions are immutable — `npm publish` will reject a re-publish at the same version. Always bump before publishing.
- If step 1 was already done manually, skip it — running `/publish` again at the same version will fail at the tag step. Go straight to step 2 once CI is green.
- `CUBIFY_LOCAL=1` in `cfop-app/.env.local` bypasses the registry entirely for local dev — changes there are immediate without any of these steps.
- CI uses `GITHUB_TOKEN` for both publishing (cubify) and installing (cfop) — no extra secrets needed.
