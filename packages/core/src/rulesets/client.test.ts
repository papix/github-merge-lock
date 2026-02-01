import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RepositoryNotFoundError } from '../utils/errors.js'
import { getRulesetStatus, lockBranchWithRuleset, resolveRulesetName, unlockBranchWithRuleset } from './client.js'

type ResponseConfig = {
  body: unknown
  ok?: boolean
  status?: number
  contentType?: string
}

const buildResponse = ({
  body,
  ok = true,
  status = 200,
  contentType = 'application/json',
}: ResponseConfig) => ({
  ok,
  status,
  headers: {
    get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null),
  },
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
})

const mockFetchSequence = (...responses: ResponseConfig[]) => {
  const fetchMock = vi.fn()
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(buildResponse(response))
  }
  globalThis.fetch = fetchMock as typeof fetch
  return fetchMock
}

describe('rulesets client', () => {
  const originalEnv = { ...process.env }
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env = { ...originalEnv, GITHUB_TOKEN: 'token' }
  })

  afterEach(() => {
    process.env = originalEnv
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('resolves default ruleset name', () => {
    expect(resolveRulesetName('main')).toBe('github-merge-lock:main')
  })

  it('uses custom ruleset name when provided', () => {
    expect(resolveRulesetName('main', 'custom-name')).toBe('custom-name')
  })

  it('returns status when ruleset is missing', async () => {
    mockFetchSequence({ body: [] })

    const status = await getRulesetStatus({ owner: 'owner', repo: 'repo', branch: 'main' })

    expect(status).toEqual({
      locked: false,
      found: false,
      name: 'github-merge-lock:main',
    })
  })

  it('returns status when ruleset is active', async () => {
    mockFetchSequence({
      body: [
        {
          id: 1,
          name: 'github-merge-lock:main',
          target: 'branch',
          enforcement: 'enabled',
        },
      ],
    })

    const status = await getRulesetStatus({ owner: 'owner', repo: 'repo', branch: 'main' })

    expect(status.locked).toBe(true)
    expect(status.found).toBe(true)
    expect(status.rulesetId).toBe(1)
    expect(status.enforcement).toBe('enabled')
  })

  it('creates ruleset when not found', async () => {
    const fetchMock = mockFetchSequence(
      { body: [] },
      {
        body: {
          id: 10,
          name: 'github-merge-lock:main',
          target: 'branch',
          enforcement: 'active',
        },
      },
    )

    const changed = await lockBranchWithRuleset({ owner: 'owner', repo: 'repo', branch: 'main' })

    expect(changed).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, createOptions] = fetchMock.mock.calls[1]
    const payload = JSON.parse(String(createOptions?.body)) as {
      conditions: { ref_name: { exclude: string[] } }
    }
    expect(payload.conditions.ref_name.exclude).toEqual([])
  })

  it('does nothing when already locked', async () => {
    const fetchMock = mockFetchSequence({
      body: [
        {
          id: 1,
          name: 'github-merge-lock:main',
          target: 'branch',
          enforcement: 'active',
        },
      ],
    })

    const changed = await lockBranchWithRuleset({ owner: 'owner', repo: 'repo', branch: 'main' })

    expect(changed).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('updates ruleset when locked state differs', async () => {
    const fetchMock = mockFetchSequence(
      {
        body: [
          {
            id: 2,
            name: 'github-merge-lock:main',
            target: 'branch',
            enforcement: 'disabled',
          },
        ],
      },
      {
        body: {
          id: 2,
          name: 'github-merge-lock:main',
          target: 'branch',
          enforcement: 'active',
        },
      },
    )

    const changed = await lockBranchWithRuleset({ owner: 'owner', repo: 'repo', branch: 'main' })

    expect(changed).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, updateOptions] = fetchMock.mock.calls[1]
    expect(updateOptions?.method).toBe('PUT')
  })

  it('does nothing when unlock target is missing', async () => {
    const fetchMock = mockFetchSequence({ body: [] })

    const changed = await unlockBranchWithRuleset({ owner: 'owner', repo: 'repo', branch: 'main' })

    expect(changed).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does nothing when already unlocked', async () => {
    const fetchMock = mockFetchSequence({
      body: [
        {
          id: 3,
          name: 'github-merge-lock:main',
          target: 'branch',
          enforcement: 'disabled',
        },
      ],
    })

    const changed = await unlockBranchWithRuleset({ owner: 'owner', repo: 'repo', branch: 'main' })

    expect(changed).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('updates ruleset when unlocking an active rule', async () => {
    const fetchMock = mockFetchSequence(
      {
        body: [
          {
            id: 4,
            name: 'github-merge-lock:main',
            target: 'branch',
            enforcement: 'active',
          },
        ],
      },
      {
        body: {
          id: 4,
          name: 'github-merge-lock:main',
          target: 'branch',
          enforcement: 'disabled',
        },
      },
    )

    const changed = await unlockBranchWithRuleset({ owner: 'owner', repo: 'repo', branch: 'main' })

    expect(changed).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('includes errors and docs in error message', async () => {
    mockFetchSequence({
      ok: false,
      status: 422,
      body: {
        message: 'Validation Failed',
        errors: [{ message: 'Missing required parameter `exclude`' }],
        documentation_url: 'https://docs.github.com',
      },
    })

    const error = await getRulesetStatus({ owner: 'owner', repo: 'repo', branch: 'main' }).catch((err) => err)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('errors: [{"message":"Missing required parameter `exclude`"}]')
    expect(error.message).toContain('docs: https://docs.github.com')
  })

  it('uses plain text error messages for non-json responses', async () => {
    mockFetchSequence({
      ok: false,
      status: 500,
      contentType: 'text/plain',
      body: 'Server Error',
    })

    const error = await getRulesetStatus({ owner: 'owner', repo: 'repo', branch: 'main' }).catch((err) => err)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('Server Error')
  })

  it('handles non-serializable errors safely', async () => {
    const circular: { self?: unknown } = {}
    circular.self = circular

    mockFetchSequence({
      ok: false,
      status: 422,
      body: {
        message: 'Validation Failed',
        errors: circular,
      },
    })

    await expect(getRulesetStatus({ owner: 'owner', repo: 'repo', branch: 'main' })).rejects.toThrow(
      'errors: [object Object]',
    )
  })

  it('throws RepositoryNotFoundError on 404', async () => {
    mockFetchSequence({
      ok: false,
      status: 404,
      body: { message: 'Not Found' },
    })

    await expect(getRulesetStatus({ owner: 'owner', repo: 'repo', branch: 'main' })).rejects.toBeInstanceOf(
      RepositoryNotFoundError,
    )
  })
})
