# github-merge-lock

Lock/unlock GitHub branches via repository rulesets to control merges.

## Packages

This monorepo contains:

| Package | Description |
|---------|-------------|
| [@papix/github-merge-lock-core](./packages/core) | Core library |
| [@papix/github-merge-lock-cli](./packages/cli) | CLI tool |
| [GitHub Actions](./actions) | Reusable GitHub Actions |

## Prerequisites

- Node.js >= 20
- pnpm >= 10
- A GitHub token with `admin:repo_hook` scope (for classic PAT) or `Repository administration: Write` permission (for fine-grained PAT or GitHub App)
- Repository rulesets must be available for the target repository

## Installation

```bash
pnpm add -g @papix/github-merge-lock-cli
```

Or run directly with pnpm dlx:

```bash
pnpm dlx @papix/github-merge-lock-cli <command>
```

## CLI Usage

### Authentication

Set your GitHub token as an environment variable:

```bash
export GITHUB_TOKEN="your-token"
# or
export GH_TOKEN="your-token"
```

Or use a GitHub App (CLI loads `.env.local` automatically when not in CI):

```bash
export GH_APP_ID="123456"
export GH_APP_PRIVATE_KEY_PATH="/path/to/private-key.pem"
# or
export GH_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> **Note**: If you set both token and GitHub App credentials, the token is used first.

### Commands

#### Lock a branch

```bash
github-merge-lock lock --owner <owner> --repo <repo> --branch <branch>
```

#### Unlock a branch

```bash
github-merge-lock unlock --owner <owner> --repo <repo> --branch <branch>
```

#### Check branch status

```bash
github-merge-lock status --owner <owner> --repo <repo> --branch <branch>
```

Local development without global install:

```bash
pnpm install
pnpm run cli -- status --owner <owner> --repo <repo> --branch <branch>
```

Exit codes:
- `0`: Branch is locked
- `1`: Branch is unlocked
- `2`: Error occurred

> **Note**: The exit codes are designed to reflect the lock status directly, not success/failure. If you prefer standard UNIX semantics where `0` means success, use the `--json` option and parse the output instead.

## Library Usage (Core)

Install the core package:

```bash
pnpm add @papix/github-merge-lock-core
```

Example:

```ts
import { getRulesetStatus } from '@papix/github-merge-lock-core'
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--owner` | `-o` | Repository owner |
| `--repo` | `-r` | Repository name |
| `--branch` | `-b` | Branch name |
| `--dry-run` | - | Show what would be done without making changes |
| `--json` | - | Output in JSON format |
| `--ruleset-name <name>` | - | Ruleset name (default: `github-merge-lock:<branch>`) |

### Ruleset Mode

This tool manages branch locks via repository rulesets (Restrict updates).

```bash
github-merge-lock lock --owner <owner> --repo <repo> --branch <branch>
github-merge-lock unlock --owner <owner> --repo <repo> --branch <branch>
github-merge-lock status --owner <owner> --repo <repo> --branch <branch>
```

Use a custom ruleset name if needed:

```bash
github-merge-lock lock --owner <owner> --repo <repo> --branch <branch> --ruleset-name "<name>"
```

## Reusable Workflow (Recommended)

Create a workflow file in your repository:

```yaml
# .github/workflows/github-merge-lock.yml
name: Merge Lock

on:
  workflow_dispatch:

jobs:
  merge-lock:
    uses: papix/github-merge-lock/.github/workflows/github-merge-lock.yml@v1
    with:
      command: lock
      branch: production
    secrets:
      token: ${{ secrets.ADMIN_TOKEN }}
```

Or use a GitHub App:

```yaml
jobs:
  merge-lock:
    uses: papix/github-merge-lock/.github/workflows/github-merge-lock.yml@v1
    with:
      command: lock
      branch: production
    secrets:
      app_id: ${{ secrets.GH_APP_ID }}
      app_private_key: ${{ secrets.GH_APP_PRIVATE_KEY }}
```

### Configuration Options

```yaml
jobs:
  merge-lock:
    uses: papix/github-merge-lock/.github/workflows/github-merge-lock.yml@v1
    with:
      command: lock           # lock | unlock | status
      branch: production
      owner: toggle-inc       # Optional (defaults to caller repo owner)
      repo: toggle-accounts   # Optional (defaults to caller repo name)
      ruleset_name: ''        # Optional (default: github-merge-lock:<branch>)
    secrets:
      token: ${{ secrets.ADMIN_TOKEN }}
```

### Workflow Outputs

| Output | Description |
|--------|-------------|
| `changed` | Whether the lock/unlock operation changed state |
| `locked` | Lock status (status command) |
| `ruleset_id` | Ruleset ID (status command) |

### Workflow Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `token` | No | GitHub token with repository administration permissions |
| `app_id` | No | GitHub App id |
| `app_private_key` | No | GitHub App private key (PEM) |

> **Note**: Provide either `token` or `app_id` + `app_private_key`.

## Individual Actions (Internal)

The composite actions under `actions/` are internal implementation details and may change. Use the reusable workflow instead.

## How It Works

This tool uses repository rulesets to restrict updates. When a branch is locked:

1. Direct pushes to the branch are blocked
2. Pull requests cannot be merged into the branch
3. Only users with admin access can unlock the branch

This is useful for:
- Preventing merges during deployments
- Coordinating releases across multiple repositories
- Implementing merge freezes during incidents

## Authentication Options

### Personal Access Token (Classic)

Create a token with the `admin:repo_hook` scope.

### Fine-grained Personal Access Token

Create a token with:
- Repository access: Select the target repository
- Permissions: Repository administration (Write)

### GitHub App

Create a GitHub App with:
- Repository permissions: Administration (Write)

Install the app on the target repository and use the installation token.

## License

MIT
