import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:crypto', () => ({
  default: {
    createSign: vi.fn(() => ({
      update: vi.fn(),
      end: vi.fn(),
      sign: vi.fn(() => 'signature'),
    })),
  },
}))

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(() => 'pem'),
  },
}))

import crypto from 'node:crypto'
import fs from 'node:fs'
import { ensureGitHubToken } from './github-app.js'

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

describe('ensureGitHubToken', () => {
  const originalEnv = { ...process.env }
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.GITHUB_TOKEN
    delete process.env.GH_TOKEN
    delete process.env.GH_APP_ID
    delete process.env.GH_APP_PRIVATE_KEY
    delete process.env.GH_APP_PRIVATE_KEY_PATH
    delete process.env.GITHUB_API_URL
  })

  afterEach(() => {
    process.env = originalEnv
    globalThis.fetch = originalFetch
    vi.clearAllMocks()
  })

  it('returns early when GITHUB_TOKEN is set', async () => {
    process.env.GITHUB_TOKEN = 'token'
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as typeof fetch

    await ensureGitHubToken('owner', 'repo')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when app credentials are missing', async () => {
    process.env.GH_APP_PRIVATE_KEY = 'key'

    await expect(ensureGitHubToken('owner', 'repo')).rejects.toThrow('GitHub トークンが見つかりません')
  })

  it('throws when owner or repo is missing', async () => {
    process.env.GH_APP_ID = '123'
    process.env.GH_APP_PRIVATE_KEY = 'key'

    await expect(ensureGitHubToken()).rejects.toThrow('owner と repo')
  })

  it('throws when installation is missing', async () => {
    process.env.GH_APP_ID = '123'
    process.env.GH_APP_PRIVATE_KEY = 'key'
    const fetchMock = vi.fn().mockResolvedValueOnce(buildResponse({ body: {} }))
    globalThis.fetch = fetchMock as typeof fetch

    await expect(ensureGitHubToken('owner', 'repo')).rejects.toThrow('インストールIDが見つかりません')
  })

  it('surfaces API errors with JSON payload', async () => {
    process.env.GH_APP_ID = '123'
    process.env.GH_APP_PRIVATE_KEY = 'key'
    const fetchMock = vi.fn().mockResolvedValueOnce(
      buildResponse({
        ok: false,
        status: 401,
        body: { message: 'Bad credentials' },
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    await expect(ensureGitHubToken('owner', 'repo')).rejects.toThrow('Bad credentials')
  })

  it('surfaces API errors with text payload', async () => {
    process.env.GH_APP_ID = '123'
    process.env.GH_APP_PRIVATE_KEY = 'key'
    const fetchMock = vi.fn().mockResolvedValueOnce(
      buildResponse({
        ok: false,
        status: 500,
        contentType: 'text/plain',
        body: 'Server Error',
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    await expect(ensureGitHubToken('owner', 'repo')).rejects.toThrow('Server Error')
  })

  it('throws when token response is missing', async () => {
    process.env.GH_APP_ID = '123'
    process.env.GH_APP_PRIVATE_KEY = 'key'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buildResponse({ body: { id: 42 } }))
      .mockResolvedValueOnce(buildResponse({ body: {} }))
    globalThis.fetch = fetchMock as typeof fetch

    await expect(ensureGitHubToken('owner', 'repo')).rejects.toThrow('インストールアクセストークンの取得に失敗しました')
  })

  it('sets GITHUB_TOKEN when app token is created', async () => {
    process.env.GH_APP_ID = '123'
    process.env.GH_APP_PRIVATE_KEY_PATH = '/path/key.pem'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buildResponse({ body: { id: 42 } }))
      .mockResolvedValueOnce(buildResponse({ body: { token: 'app-token' } }))
    globalThis.fetch = fetchMock as typeof fetch

    await ensureGitHubToken('owner', 'repo')

    expect(process.env.GITHUB_TOKEN).toBe('app-token')
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/key.pem', 'utf8')
    expect(crypto.createSign).toHaveBeenCalled()
  })
})
