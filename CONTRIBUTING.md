# Contributing

## What belongs here

The crawl, the HTML parser, robots.txt and sitemap parsing, running a rule set, the score and the Markdown and JSON report: what both [search-auditor](https://github.com/a-bibikov/search-auditor) and [ai-search-auditor](https://github.com/a-bibikov/ai-search-audit) need. Checks and their texts live in those packages, never here.

A change ships with tests (`test/`), and `npm test` must pass. A change to the exports or the report is released here first; then both packages raise their `auditor-engine` range.

## Branches

All work goes to `dev` through pull requests. The branch name sets the release type:

| Branch | Example | PR title becomes | Release |
|---|---|---|---|
| `feat/…` | `feat/report-width` | `feat: …` | minor (0.1 → 0.2) |
| `fix/…` | `fix/sitemap-index` | `fix: …` | patch (0.1.0 → 0.1.1) |
| `docs/…` | `docs/roadmap` | `docs: …` | patch |
| `chore/…`, `ci/…`, `test/…`, `refactor/…`, `perf/…` | `ci/node-26` | `chore: …` and so on | no release (`perf` — patch) |

The prefix is added to the PR title automatically; write the rest of the title for people — it goes into the CHANGELOG. A pull request from a branch with another name fails the check.

A breaking change (report format, flags, behaviour): put `!` before the colon in the title yourself, `feat!: new JSON report format`. While the version is 0.x it raises minor, from 1.0 — major.

Merge into `dev` with **Squash and merge**: the PR title becomes the one commit on `dev`.

## Releases

1. When `dev` is ready, merge it into `main` with **Create a merge commit** (not squash: release-please needs every `feat:` and `fix:` commit).
2. The Release workflow keeps a pull request «chore(main): release X.Y.Z» with the next version and the CHANGELOG.
3. Merging it tags `vX.Y.Z`, creates the GitHub Release, publishes to npm and merges the release back into `dev`.
4. If npm holds the version in staging, approve it on npmjs.com → Staged Packages (needs 2FA).

To force a version, add a footer to a commit message: `Release-As: 0.2.0`.

Never change `version` in `package.json` by hand: release-please owns it.
