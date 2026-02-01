import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunContext, RunDeps } from '#core/cli-types.js'

const rulesetMocks = vi.hoisted(() => ({
  unlockBranchWithRuleset: vi.fn(),
  resolveRulesetName: vi.fn(),
}))

vi.mock('#core/rulesets/client.js', () => rulesetMocks)

import { run } from './index.js'

describe('github-merge-lock-unlock action', () => {
  const originalEnv = { ...process.env }
  const coreMocks: RunDeps['core'] = {
    info: vi.fn(),
    warning: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
  }
  const deps: RunDeps = {
    core: coreMocks,
    fs: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
  }

  beforeEach(() => {
    process.env = { ...originalEnv }
    rulesetMocks.resolveRulesetName.mockImplementation((branch: string, name?: string) => name ?? `github-merge-lock:${branch}`)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  const createContext = (env: Record<string, string | undefined>): RunContext => ({
    env,
    argv: [],
    cwd: () => '/repo',
  })

  it('sets outputs when unlock succeeds', async () => {
    const ctx = createContext({
      INPUT_GITHUB_TOKEN: 'token',
      INPUT_OWNER: 'owner',
      INPUT_REPO: 'repo',
      INPUT_BRANCH: 'main',
      INPUT_RULESET_NAME: '',
    })
    rulesetMocks.unlockBranchWithRuleset.mockResolvedValue(true)

    await run(ctx, deps)

    expect(rulesetMocks.unlockBranchWithRuleset).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      rulesetName: undefined,
    })
    expect(coreMocks.setOutput).toHaveBeenCalledWith('changed', 'true')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('ruleset_name', 'github-merge-lock:main')
    expect(coreMocks.info).toHaveBeenCalledWith(
      'Unlocked branch "main" in owner/repo (ruleset: github-merge-lock:main)',
    )
  })

  it('logs when already unlocked', async () => {
    const ctx = createContext({
      INPUT_GITHUB_TOKEN: 'token',
      INPUT_OWNER: 'owner',
      INPUT_REPO: 'repo',
      INPUT_BRANCH: 'main',
      INPUT_RULESET_NAME: 'custom',
    })
    rulesetMocks.unlockBranchWithRuleset.mockResolvedValue(false)

    await run(ctx, deps)

    expect(coreMocks.setOutput).toHaveBeenCalledWith('changed', 'false')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('ruleset_name', 'custom')
    expect(coreMocks.info).toHaveBeenCalledWith(
      'Branch "main" is already unlocked in owner/repo (ruleset: custom)',
    )
  })

  it('uses repository from environment when inputs are empty', async () => {
    const ctx = createContext({
      INPUT_GITHUB_TOKEN: 'token',
      INPUT_OWNER: '',
      INPUT_REPO: '',
      INPUT_BRANCH: 'main',
      INPUT_RULESET_NAME: '',
      GITHUB_REPOSITORY_OWNER: 'env-owner',
      GITHUB_REPOSITORY: 'env-owner/env-repo',
    })
    rulesetMocks.unlockBranchWithRuleset.mockResolvedValue(true)

    await run(ctx, deps)

    expect(rulesetMocks.unlockBranchWithRuleset).toHaveBeenCalledWith({
      owner: 'env-owner',
      repo: 'env-repo',
      branch: 'main',
      rulesetName: undefined,
    })
  })

  it('fails when repository context is missing', async () => {
    const ctx = createContext({
      INPUT_GITHUB_TOKEN: 'token',
      INPUT_OWNER: '',
      INPUT_REPO: '',
      INPUT_BRANCH: 'main',
      INPUT_RULESET_NAME: '',
    })

    await run(ctx, deps)

    expect(coreMocks.setFailed).toHaveBeenCalledWith('owner/repo is required. Set inputs or GITHUB_REPOSITORY env.')
  })

  it('fails when github_token is missing', async () => {
    const ctx = createContext({
      INPUT_OWNER: 'owner',
      INPUT_REPO: 'repo',
      INPUT_BRANCH: 'main',
      INPUT_RULESET_NAME: '',
    })

    await run(ctx, deps)

    expect(coreMocks.setFailed).toHaveBeenCalledWith('github_token is required.')
  })
})
