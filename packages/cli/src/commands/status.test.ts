import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as rulesetModule from '#core/rulesets/client.js'

vi.mock('#core/rulesets/client.js', () => ({
  getRulesetStatus: vi.fn(),
  resolveRulesetName: (branch: string, rulesetName?: string) => rulesetName ?? `github-merge-lock:${branch}`,
}))

describe('status command', () => {
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

  it('should show locked status and exit with 0', async () => {
    mockGetRulesetStatus.mockResolvedValue({
      locked: true,
      found: true,
      name: 'github-merge-lock:main',
      rulesetId: 42,
      enforcement: 'active',
    })

    const { statusCommand } = await import('./status.js')
    await statusCommand.parseAsync(['node', 'test', '--owner', 'testowner', '--repo', 'testrepo', '--branch', 'main'])

    expect(mockGetRulesetStatus).toHaveBeenCalledWith({
      owner: 'testowner',
      repo: 'testrepo',
      branch: 'main',
      rulesetName: undefined,
    })
    expect(logs).toContain('Branch: main')
    expect(logs).toContain('Ruleset: github-merge-lock:main (id: 42)')
    expect(logs).toContain('Enforcement: active')
    expect(logs).toContain('Status: LOCKED')
    expect(process.exit).toHaveBeenCalledWith(0)
  })

  it('should show unlocked status and exit with 1', async () => {
    mockGetRulesetStatus.mockResolvedValue({
      locked: false,
      found: true,
      name: 'github-merge-lock:main',
      rulesetId: 42,
      enforcement: 'disabled',
    })

    const { statusCommand } = await import('./status.js')
    await statusCommand.parseAsync(['node', 'test', '--owner', 'testowner', '--repo', 'testrepo', '--branch', 'main'])

    expect(logs).toContain('Branch: main')
    expect(logs).toContain('Ruleset: github-merge-lock:main (id: 42)')
    expect(logs).toContain('Enforcement: disabled')
    expect(logs).toContain('Status: UNLOCKED')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('should handle errors and exit with 2', async () => {
    mockGetRulesetStatus.mockRejectedValue(new Error('API Error'))

    const { statusCommand } = await import('./status.js')
    await statusCommand.parseAsync(['node', 'test', '--owner', 'testowner', '--repo', 'testrepo', '--branch', 'main'])

    expect(errors).toContain('Error: API Error')
    expect(process.exit).toHaveBeenCalledWith(2)
  })

  it('should output JSON when --json flag is provided and locked', async () => {
    mockGetRulesetStatus.mockResolvedValue({
      locked: true,
      found: true,
      name: 'github-merge-lock:main',
      rulesetId: 42,
      enforcement: 'active',
    })

    const { statusCommand } = await import('./status.js')
    await statusCommand.parseAsync([
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
      locked: true,
      rulesetName: 'github-merge-lock:main',
      rulesetId: 42,
      enforcement: 'active',
      found: true,
      mode: 'ruleset',
    })
    expect(process.exit).not.toHaveBeenCalled()
  })

  it('should output JSON when --json flag is provided and unlocked', async () => {
    mockGetRulesetStatus.mockResolvedValue({
      locked: false,
      found: true,
      name: 'github-merge-lock:main',
      rulesetId: 42,
      enforcement: 'disabled',
    })

    const { statusCommand } = await import('./status.js')
    await statusCommand.parseAsync([
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
    expect(output.locked).toBe(false)
    expect(process.exit).not.toHaveBeenCalled()
  })

  it('should show not found status and exit with 1', async () => {
    mockGetRulesetStatus.mockResolvedValue({
      locked: false,
      found: false,
      name: 'github-merge-lock:main',
    })

    const { statusCommand } = await import('./status.js')
    await statusCommand.parseAsync(['node', 'test', '--owner', 'testowner', '--repo', 'testrepo', '--branch', 'main'])

    expect(logs).toContain('Branch: main')
    expect(logs).toContain('Ruleset: github-merge-lock:main (not found)')
    expect(logs).toContain('Status: UNLOCKED')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('should output JSON error on failure', async () => {
    mockGetRulesetStatus.mockRejectedValue(new Error('API Error'))

    const { statusCommand } = await import('./status.js')
    await statusCommand.parseAsync([
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
      error: 'API Error',
      mode: 'ruleset',
    })
    expect(process.exit).toHaveBeenCalledWith(2)
  })
})
