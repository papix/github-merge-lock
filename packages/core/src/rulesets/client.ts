import type { LockOptions, RulesetEnforcement, RulesetStatusResult, RulesetSummary } from '../types/index.js'
import { getGitHubToken } from '../utils/config.js'
import { ensureGitHubToken } from '../utils/github-app.js'
import { RepositoryNotFoundError } from '../utils/errors.js'

export type RulesetOptions = LockOptions & {
  rulesetName?: string
}

const DEFAULT_API_BASE_URL = 'https://api.github.com'
const API_VERSION = '2022-11-28'
const RULESET_NAME_PREFIX = 'github-merge-lock'
const ACTIVE_ENFORCEMENTS = new Set<RulesetEnforcement>(['active', 'enabled'])

type RequestOptions = {
  method?: string
  body?: unknown
  owner?: string
  repo?: string
}

export function resolveRulesetName(branch: string, rulesetName?: string): string {
  if (rulesetName?.trim()) {
    return rulesetName
  }
  return `${RULESET_NAME_PREFIX}:${branch}`
}

function buildRefName(branch: string): string {
  return `refs/heads/${branch}`
}

function isActiveEnforcement(enforcement?: RulesetEnforcement): boolean {
  return enforcement ? ACTIVE_ENFORCEMENTS.has(enforcement) : false
}

async function requestGitHub<T>(path: string, options: RequestOptions = {}): Promise<T> {
  await ensureGitHubToken(options.owner, options.repo)
  const token = getGitHubToken()
  const baseUrl = process.env.GITHUB_API_URL ?? DEFAULT_API_BASE_URL
  const url = new URL(path, baseUrl)

  const method = options.method ?? (options.body ? 'POST' : 'GET')
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'github-merge-lock',
    'x-github-api-version': API_VERSION,
  }
  if (options.body) {
    headers['content-type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    if (response.status === 404 && options.owner && options.repo) {
      throw new RepositoryNotFoundError(options.owner, options.repo)
    }
    if (typeof data === 'string') {
      throw new Error(`GitHub API Error (${response.status}): ${data}`)
    }
    const payload = data as { message?: string; errors?: unknown; documentation_url?: string }
    let message = payload.message ?? safeStringify(payload)
    if (payload.errors) {
      message += ` (errors: ${safeStringify(payload.errors)})`
    }
    if (payload.documentation_url) {
      message += ` (docs: ${payload.documentation_url})`
    }
    throw new Error(`GitHub API Error (${response.status}): ${message}`)
  }

  return data as T
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function listRepositoryRulesets(owner: string, repo: string): Promise<RulesetSummary[]> {
  const ownerParam = encodeURIComponent(owner)
  const repoParam = encodeURIComponent(repo)
  const path = `/repos/${ownerParam}/${repoParam}/rulesets?targets=branch&includes_parents=false&per_page=100`
  return requestGitHub<RulesetSummary[]>(path, { owner, repo })
}

async function findRepositoryRulesetByName(
  owner: string,
  repo: string,
  rulesetName: string,
): Promise<RulesetSummary | null> {
  const rulesets = await listRepositoryRulesets(owner, repo)
  return rulesets.find((ruleset) => ruleset.name === rulesetName) ?? null
}

async function createRulesetForBranch(options: RulesetOptions, rulesetName: string): Promise<RulesetSummary> {
  const ownerParam = encodeURIComponent(options.owner)
  const repoParam = encodeURIComponent(options.repo)
  const path = `/repos/${ownerParam}/${repoParam}/rulesets`
  const payload = {
    name: rulesetName,
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        include: [buildRefName(options.branch)],
        exclude: [],
      },
    },
    rules: [
      {
        type: 'update',
        parameters: {
          update_allows_fetch_and_merge: false,
        },
      },
    ],
  }

  return requestGitHub<RulesetSummary>(path, {
    method: 'POST',
    body: payload,
    owner: options.owner,
    repo: options.repo,
  })
}

async function updateRulesetEnforcement(
  owner: string,
  repo: string,
  rulesetId: number,
  enforcement: RulesetEnforcement,
): Promise<RulesetSummary> {
  const ownerParam = encodeURIComponent(owner)
  const repoParam = encodeURIComponent(repo)
  const path = `/repos/${ownerParam}/${repoParam}/rulesets/${rulesetId}`
  return requestGitHub<RulesetSummary>(path, {
    method: 'PUT',
    body: { enforcement },
    owner,
    repo,
  })
}

export async function getRulesetStatus(options: RulesetOptions): Promise<RulesetStatusResult> {
  const rulesetName = resolveRulesetName(options.branch, options.rulesetName)
  const ruleset = await findRepositoryRulesetByName(options.owner, options.repo, rulesetName)

  if (!ruleset) {
    return {
      locked: false,
      found: false,
      name: rulesetName,
    }
  }

  return {
    locked: isActiveEnforcement(ruleset.enforcement),
    found: true,
    name: ruleset.name,
    rulesetId: ruleset.id,
    enforcement: ruleset.enforcement,
  }
}

export async function lockBranchWithRuleset(options: RulesetOptions): Promise<boolean> {
  const rulesetName = resolveRulesetName(options.branch, options.rulesetName)
  const existing = await findRepositoryRulesetByName(options.owner, options.repo, rulesetName)

  if (!existing) {
    await createRulesetForBranch(options, rulesetName)
    return true
  }

  if (isActiveEnforcement(existing.enforcement)) {
    return false
  }

  await updateRulesetEnforcement(options.owner, options.repo, existing.id, 'active')
  return true
}

export async function unlockBranchWithRuleset(options: RulesetOptions): Promise<boolean> {
  const rulesetName = resolveRulesetName(options.branch, options.rulesetName)
  const existing = await findRepositoryRulesetByName(options.owner, options.repo, rulesetName)

  if (!existing) {
    return false
  }

  if (!isActiveEnforcement(existing.enforcement)) {
    return false
  }

  await updateRulesetEnforcement(options.owner, options.repo, existing.id, 'disabled')
  return true
}
