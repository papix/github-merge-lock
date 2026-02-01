import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunContext, RunDeps } from '#core/cli-types.js'

const rulesetMocks = vi.hoisted(() => ({
  getRulesetStatus: vi.fn(),
}))

vi.mock('#core/rulesets/client.js', () => rulesetMocks)

import { run } from './index.js'

describe('github-merge-lock-status action', () => {
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

  it('sets outputs when ruleset is found', async () => {
    const ctx = createContext({
      INPUT_GITHUB_TOKEN: 'token',
      INPUT_OWNER: 'owner',
      INPUT_REPO: 'repo',
      INPUT_BRANCH: 'main',
      INPUT_RULESET_NAME: '',
    })
    rulesetMocks.getRulesetStatus.mockResolvedValue({
      locked: true,
      found: true,
      name: 'github-merge-lock:main',
      rulesetId: 42,
      enforcement: 'active',
    })

    await run(ctx, deps)

    expect(coreMocks.setOutput).toHaveBeenCalledWith('locked', 'true')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('ruleset_id', '42')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('enforcement', 'active')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('found', 'true')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('ruleset_name', 'github-merge-lock:main')
    expect(coreMocks.info).toHaveBeenCalledWith('Status: LOCKED')
  })

  it('sets outputs when ruleset is missing', async () => {
    const ctx = createContext({
      INPUT_GITHUB_TOKEN: 'token',
      INPUT_OWNER: 'owner',
      INPUT_REPO: 'repo',
      INPUT_BRANCH: 'main',
      INPUT_RULESET_NAME: '',
    })
    rulesetMocks.getRulesetStatus.mockResolvedValue({
      locked: false,
      found: false,
      name: 'github-merge-lock:main',
    })

    await run(ctx, deps)

    expect(coreMocks.setOutput).toHaveBeenCalledWith('locked', 'false')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('ruleset_id', '')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('enforcement', '')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('found', 'false')
    expect(coreMocks.setOutput).toHaveBeenCalledWith('ruleset_name', 'github-merge-lock:main')
    expect(coreMocks.info).toHaveBeenCalledWith('Status: UNLOCKED')
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
    rulesetMocks.getRulesetStatus.mockResolvedValue({
      locked: false,
      found: false,
      name: 'github-merge-lock:main',
    })

    await run(ctx, deps)

    expect(rulesetMocks.getRulesetStatus).toHaveBeenCalledWith({
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
