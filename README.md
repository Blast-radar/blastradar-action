# ⚡ BlastRadar GitHub Action

Automatic production risk scoring for every pull request. Scores your diff 1-10 and blocks merges if risk is too high.

## Setup

Add this to `.github/workflows/blastradar.yml` in your repo:

```yaml
name: BlastRadar Risk Check
on: [pull_request]

jobs:
  risk-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - uses: Blast-radar/blastradar-action@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          threshold: '7'
```

Then add your Anthropic API key as a repository secret named `ANTHROPIC_API_KEY`.

That's it. Every PR now gets automatically scored for production risk.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| anthropic-api-key | Yes | — | Your Anthropic API key |
| threshold | No | 7 | Risk score that fails the check |

## Outputs

| Output | Description |
|--------|-------------|
| risk-score | The risk score (1-10) |
| verdict | One-line summary of the risk |

## Example output

On a pull request that touches a shared auth middleware and a database migration:

> ⚠️ **BlastRadar: Risk 8/10 — merge blocked**
> This diff modifies `auth/middleware.js` (used by 12 other routes) and adds a
> non-backwards-compatible column change in `migrations/0042_add_status.sql`.
> Rollback would require a coordinated deploy. Recommend splitting the migration
> from the auth change and adding a default value for the new column.

On a low-risk change like a CSS tweak or comment update, it passes silently with a `risk-score` of 1-2 and no blocking comment.

## Try it online

blastradar.vercel.app — paste any diff, get a risk score in 10 seconds.

## Feedback

team@blast-radar.com
