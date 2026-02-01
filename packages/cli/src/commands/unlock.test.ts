import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as rulesetModule from '#core/rulesets/client.js'

vi.mock('#core/rulesets/client.js', () => ({
  unlockBranchWithRuleset: vi.fn(),
  getRulesetStatus: vi.fn(),
  resolveRulesetName: (branch: string, rulesetName?: string) => rulesetName ?? `github-merge-lock:${branch}`,
}))

describe('unlock command', () => {
  const mockUnlockBranchWithRuleset = vi.mocked(rulesetModule.unlockBranchWithRuleset)
  const mockGetRulesetStatus = vi.mocked(rulesetModule.getRulesetStatus)
  const originalLog = console.log
  const originalError = console.error
  const originalExit = process.exit
  let logs: string[] = []
  let errors: string[] = []

  beforeEach(() => {
    logs = []
    errors = []
    console.log = vi.fn((...args: unknown[]) => {
      logs.push(args.map(String).join(' '))
    })
    console.error = vi.fn((...args: unknown[]) => {
      errors.push(args.map(String).join(' '))
    })
    process.exit = vi.fn() as never
    vi.clearAllMocks()
  })

  afterEach(() => {
    console.log = originalLog
    console.error = originalError
    process.exit = originalExit
  })

  it('should unlock a branch successfully', async () => {
    mockUnlockBranchWithRuleset.mockResolvedValue(true)

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync(['node', 'test', '--owner', 'testowner', '--repo', 'testrepo', '--branch', 'main'])

    expect(mockUnlockBranchWithRuleset).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'testowner',
        repo: 'testrepo',
        branch: 'main',
      }),
    )
    expect(logs).toContain('Unlocked branch "main" in testowner/testrepo (ruleset: github-merge-lock:main)')
  })

  it('should report when branch is already unlocked', async () => {
    mockUnlockBranchWithRuleset.mockResolvedValue(false)

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync(['node', 'test', '--owner', 'testowner', '--repo', 'testrepo', '--branch', 'main'])

    expect(logs).toContain('Branch "main" is already unlocked in testowner/testrepo (ruleset: github-merge-lock:main)')
  })

  it('should handle errors', async () => {
    mockUnlockBranchWithRuleset.mockRejectedValue(new Error('API Error'))

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync(['node', 'test', '--owner', 'testowner', '--repo', 'testrepo', '--branch', 'main'])

    expect(errors).toContain('Error: API Error')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('should show dry-run output without making changes', async () => {
    mockGetRulesetStatus.mockResolvedValue({
      locked: true,
      found: true,
      name: 'github-merge-lock:main',
      rulesetId: 42,
      enforcement: 'active',
    })

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync([
      'node',
      'test',
      '--owner',
      'testowner',
      '--repo',
      'testrepo',
      '--branch',
      'main',
      '--dry-run',
    ])

    expect(mockUnlockBranchWithRuleset).not.toHaveBeenCalled()
    expect(logs).toContain(
      '[DRY-RUN] Would unlock branch "main" in testowner/testrepo (ruleset: github-merge-lock:main)',
    )
    expect(logs).toContain('Current status: LOCKED (rulesetId: 42, enforcement: active)')
  })

  it('should show dry-run output when ruleset is missing', async () => {
    mockGetRulesetStatus.mockResolvedValue({
      locked: false,
      found: false,
      name: 'github-merge-lock:main',
    })

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync([
      'node',
      'test',
      '--owner',
      'testowner',
      '--repo',
      'testrepo',
      '--branch',
      'main',
      '--dry-run',
    ])

    expect(mockUnlockBranchWithRuleset).not.toHaveBeenCalled()
    expect(logs).toContain(
      '[DRY-RUN] Would unlock branch "main" in testowner/testrepo (ruleset: github-merge-lock:main)',
    )
    expect(logs).toContain('Current status: UNLOCKED (ruleset not found)')
  })

  it('should output JSON when --json flag is provided', async () => {
    mockUnlockBranchWithRuleset.mockResolvedValue(true)

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync([
      'node',
      'test',
      '--owner',
      'testowner',
      '--repo',
      'testrepo',
      '--branch',
      'main',
      '--json',
    ])

    expect(logs.length).toBe(1)
    const output = JSON.parse(logs[0] as string)
    expect(output).toEqual({
      success: true,
      changed: true,
      branch: 'main',
      owner: 'testowner',
      repo: 'testrepo',
      mode: 'ruleset',
      rulesetName: 'github-merge-lock:main',
    })
  })

  it('should output JSON with changed=false when already unlocked', async () => {
    mockUnlockBranchWithRuleset.mockResolvedValue(false)

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync([
      'node',
      'test',
      '--owner',
      'testowner',
      '--repo',
      'testrepo',
      '--branch',
      'main',
      '--json',
    ])

    const output = JSON.parse(logs[0] as string)
    expect(output.changed).toBe(false)
  })

  it('should output JSON for dry-run', async () => {
    mockGetRulesetStatus.mockResolvedValue({
      locked: true,
      found: true,
      name: 'github-merge-lock:main',
      rulesetId: 99,
      enforcement: 'active',
    })

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync([
      'node',
      'test',
      '--owner',
      'testowner',
      '--repo',
      'testrepo',
      '--branch',
      'main',
      '--dry-run',
      '--json',
    ])

    const output = JSON.parse(logs[0] as string)
    expect(output).toEqual({
      dryRun: true,
      action: 'unlock',
      mode: 'ruleset',
      branch: 'main',
      owner: 'testowner',
      repo: 'testrepo',
      currentStatus: true,
      rulesetName: 'github-merge-lock:main',
      rulesetId: 99,
      enforcement: 'active',
      found: true,
    })
  })

  it('should output JSON for dry-run when ruleset is missing', async () => {
    mockGetRulesetStatus.mockResolvedValue({
      locked: false,
      found: false,
      name: 'github-merge-lock:main',
    })

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync([
      'node',
      'test',
      '--owner',
      'testowner',
      '--repo',
      'testrepo',
      '--branch',
      'main',
      '--dry-run',
      '--json',
    ])

    const output = JSON.parse(logs[0] as string)
    expect(output).toEqual({
      dryRun: true,
      action: 'unlock',
      mode: 'ruleset',
      branch: 'main',
      owner: 'testowner',
      repo: 'testrepo',
      currentStatus: false,
      rulesetName: 'github-merge-lock:main',
      rulesetId: null,
      enforcement: null,
      found: false,
    })
  })

  it('should output JSON error on failure', async () => {
    mockUnlockBranchWithRuleset.mockRejectedValue(new Error('API Error'))

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync([
      'node',
      'test',
      '--owner',
      'testowner',
      '--repo',
      'testrepo',
      '--branch',
      'main',
      '--json',
    ])

    const output = JSON.parse(logs[0] as string)
    expect(output).toEqual({
      success: false,
      error: 'API Error',
    })
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('should handle non-Error rejections', async () => {
    mockUnlockBranchWithRuleset.mockRejectedValue('API Error')

    const { unlockCommand } = await import('./unlock.js')
    await unlockCommand.parseAsync([
      'node',
      'test',
      '--owner',
      'testowner',
      '--repo',
      'testrepo',
      '--branch',
      'main',
      '--json',
    ])

    const output = JSON.parse(logs[0] as string)
    expect(output).toEqual({
      success: false,
      error: 'API Error',
    })
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
