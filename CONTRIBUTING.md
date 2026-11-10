# Contributing

## What belongs here

The crawl, the HTML parser, robots.txt and sitemap parsing, running a rule set, the score and the Markdown and JSON report: what both [search-auditor](https://github.com/a-bibikov/search-auditor) and [ai-search-auditor](https://github.com/a-bibikov/ai-search-audit) need. Checks and their texts live in those packages, never here.

A change ships with tests (`test/`), and `npm test` must pass. A change to the exports or the report is released here first; then both packages raise their `auditor-engine` range.

## Branches

`dev` is the main branch: all work goes there through pull requests, and `main` only ever gets `dev`.

Every task starts with an issue. Name the branch after the type of the change and the issue number:

| Branch | PR title becomes | Release |
|---|---|---|
| `feat/issue-12` | `feat: …` | minor (0.6.0 → 0.7.0) |
| `fix/issue-12` or `bug/issue-12` | `fix: …` | patch (0.6.0 → 0.6.1) |
| `docs/issue-12` | `docs: …` | patch |
| `chore/`, `ci/`, `test/`, `refactor/`, `perf/` + `issue-12` | `chore: …` and so on | no release |

The PR rules check writes the type into the title and «Closes #12» into the description, so merging closes the issue; a branch with another name fails the check. Write the rest of the title for people: it goes into the release notes.

A breaking change (report format, flags, behaviour): put `!` before the colon yourself, `feat!: new JSON report format`. It is listed under «Breaking changes» in the release notes but raises only minor: a major version is made by hand.

Merge into `dev` with **Squash and merge**: the PR title becomes the one commit on `dev`.

## Releases

1. When `dev` is ready, open a pull request from `dev` into `main` and merge it with **Create a merge commit**. Nothing else can be merged into `main`.
2. The Release workflow reads the commits since the last tag. If there is a `feat`, `fix` or `docs` among them, it releases at once: tags `vX.Y.Z`, creates the GitHub Release with the notes, publishes to npm.
3. If npm holds the version in staging, approve it on npmjs.com → Staged Packages (needs 2FA).

**A major version** is made by hand: Actions → Release → Run workflow on `main` with «major» on.

**If publishing failed:** Run workflow with «tag» set to the existing tag, for example `v0.7.0`: it publishes that tag and makes nothing new.

The version lives in the tags. `package.json` in the repository says `0.0.0-development`: the release writes the real version into its own commit, which the tag points to, so `main` only ever gets merges from `dev`. Never change the version by hand.
