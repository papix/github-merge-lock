# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage (90% threshold)
pnpm run test:coverage

# Type check
pnpm run typecheck

# Lint and format (auto-fix)
pnpm run check

# Build all packages
pnpm run build

# Run CLI locally
pnpm run cli -- <command> --owner <owner> --repo <repo> --branch <branch>
```

## Architecture

This is a pnpm monorepo with two packages:

- **packages/core** (`@papix/github-merge-lock-core`): Core library that interacts with GitHub's Repository Rulesets API to lock/unlock branches
- **packages/cli** (`@papix/github-merge-lock-cli`): CLI tool built with commander that consumes the core library

The CLI imports core via the TypeScript path alias `#core/*`.

### GitHub Actions Integration

Three composite actions in `actions/` (lock, unlock, status) call the core library directly. The reusable workflow in `.github/workflows/github-merge-lock.yml` orchestrates these actions and handles authentication (PAT or GitHub App).

### Key Files

- `packages/core/src/rulesets/client.ts` - Core API client for GitHub Rulesets
- `packages/core/src/utils/github-app.ts` - GitHub App JWT authentication
- `packages/cli/src/commands/*.ts` - CLI command implementations

## Commit Messages

Uses conventional commits with commitlint. Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`, `ci`, `build`.

## Git Hooks (Husky)

- **pre-commit**: typecheck + lint-staged (Biome check + secretlint)
- **pre-push**: blocks push to main/production, runs check:ci + knip + test
- **commit-msg**: validates conventional commit format
