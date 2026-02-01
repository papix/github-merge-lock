import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getGitHubToken } from './config.js'

describe('getGitHubToken', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns GITHUB_TOKEN when present', () => {
    process.env.GITHUB_TOKEN = 'token-1'
    process.env.GH_TOKEN = 'token-2'

    expect(getGitHubToken()).toBe('token-1')
  })

  it('returns GH_TOKEN when GITHUB_TOKEN is missing', () => {
    delete process.env.GITHUB_TOKEN
    process.env.GH_TOKEN = 'token-2'

    expect(getGitHubToken()).toBe('token-2')
  })

  it('throws when no token is set', () => {
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN

    expect(() => getGitHubToken()).toThrow('GitHub トークンが見つかりません')
  })
})
