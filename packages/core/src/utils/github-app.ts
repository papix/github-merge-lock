import fs from 'node:fs'
import crypto from 'node:crypto'

const DEFAULT_API_BASE_URL = 'https://api.github.com'
const API_VERSION = '2022-11-28'

type InstallationResponse = {
  id?: number
}

type TokenResponse = {
  token?: string
}

export async function ensureGitHubToken(owner?: string, repo?: string): Promise<void> {
  if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
    return
  }

  const appId = process.env.GH_APP_ID
  const keyPath = process.env.GH_APP_PRIVATE_KEY_PATH
  const keyEnv = process.env.GH_APP_PRIVATE_KEY
  if (!appId || (!keyPath && !keyEnv)) {
    throw new Error(
      'GitHub トークンが見つかりません。GITHUB_TOKEN/GH_TOKEN、または GH_APP_ID と GH_APP_PRIVATE_KEY(_PATH) を設定してください。',
    )
  }
  if (!owner || !repo) {
    throw new Error('GitHub App を使う場合は owner と repo が必要です。')
  }

  const pem = keyEnv ? keyEnv.replace(/\\n/g, '\n') : readPrivateKey(keyPath)
  const jwt = createJwt(appId, pem)
  const apiBase = process.env.GITHUB_API_URL ?? DEFAULT_API_BASE_URL

  const ownerParam = encodeURIComponent(owner)
  const repoParam = encodeURIComponent(repo)
  const installation = await requestGitHub<InstallationResponse>(
    `${apiBase}/repos/${ownerParam}/${repoParam}/installation`,
    'GET',
    jwt,
  )
  const installationId = installation?.id
  if (!installationId) {
    throw new Error('インストールIDが見つかりません。GitHub App のインストールを確認してください。')
  }

  const tokenResponse = await requestGitHub<TokenResponse>(
    `${apiBase}/app/installations/${installationId}/access_tokens`,
    'POST',
    jwt,
  )
  const token = tokenResponse?.token
  if (!token) {
    throw new Error('インストールアクセストークンの取得に失敗しました。')
  }

  process.env.GITHUB_TOKEN = token
}

function createJwt(appId: string, pem: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = { iat: now - 60, exp: now + 600, iss: appId }
  const unsigned = `${base64url(header)}.${base64url(payload)}`

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(unsigned)
  sign.end()
  const signature = sign.sign(pem, 'base64url')
  return `${unsigned}.${signature}`
}

function base64url(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

function readPrivateKey(pathValue?: string) {
  if (!pathValue) {
    throw new Error('GH_APP_PRIVATE_KEY_PATH が未設定です。')
  }
  return fs.readFileSync(pathValue, 'utf8')
}

async function requestGitHub<T>(url: string, method: 'GET' | 'POST', jwt: string): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${jwt}`,
      'X-GitHub-Api-Version': API_VERSION,
    },
  })

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const message = typeof data === 'string' ? data : ((data as { message?: string }).message ?? JSON.stringify(data))
    throw new Error(`GitHub API Error (${response.status}): ${message}`)
  }

  return data as T
}
