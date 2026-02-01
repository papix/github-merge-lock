import { createDefaultContext, createDefaultDeps, type RunContext, type RunDeps } from '#core/cli-types.js'
import { resolveRulesetName, unlockBranchWithRuleset } from '#core/rulesets/client.js'

const toInputKey = (name: string) => `INPUT_${name.replace(/ /g, '_').toUpperCase()}`

const getOptionalInput = (ctx: RunContext, name: string) => (ctx.env[toInputKey(name)] ?? '').trim()
const getRequiredInput = (ctx: RunContext, name: string) => {
  const value = getOptionalInput(ctx, name)
  if (!value) {
    throw new Error(`${name} is required.`)
  }
  return value
}

const resolveRepository = (ctx: RunContext, ownerInput: string, repoInput: string) => {
  const owner = ownerInput || ctx.env.GITHUB_REPOSITORY_OWNER || ''
  const repo = repoInput || ctx.env.GITHUB_REPOSITORY?.split('/')[1] || ''

  if (!owner || !repo) {
    throw new Error('owner/repo is required. Set inputs or GITHUB_REPOSITORY env.')
  }

  return { owner, repo }
}

export async function run(ctx: RunContext = createDefaultContext(), deps?: RunDeps): Promise<void> {
  const resolvedDeps = deps ?? (await createDefaultDeps())
  try {
    const token = getRequiredInput(ctx, 'github_token')
    if (token) {
      process.env.GITHUB_TOKEN = token
    }

    const ownerInput = getOptionalInput(ctx, 'owner')
    const repoInput = getOptionalInput(ctx, 'repo')
    const branch = getRequiredInput(ctx, 'branch')
    const rulesetNameInput = getOptionalInput(ctx, 'ruleset_name')
    const rulesetName = rulesetNameInput || undefined

    const { owner, repo } = resolveRepository(ctx, ownerInput, repoInput)

    const changed = await unlockBranchWithRuleset({ owner, repo, branch, rulesetName })
    const resolvedName = resolveRulesetName(branch, rulesetName)

    resolvedDeps.core.setOutput('changed', String(changed))
    resolvedDeps.core.setOutput('ruleset_name', resolvedName)

    if (changed) {
      resolvedDeps.core.info(`Unlocked branch "${branch}" in ${owner}/${repo} (ruleset: ${resolvedName})`)
    } else {
      resolvedDeps.core.info(`Branch "${branch}" is already unlocked in ${owner}/${repo} (ruleset: ${resolvedName})`)
    }
  } catch (error) {
    resolvedDeps.core.setFailed(error instanceof Error ? error.message : String(error))
  }
}

/* c8 ignore start - production entry point */
if (process.env.GITHUB_ACTIONS === 'true') {
  run()
}
/* c8 ignore stop */
