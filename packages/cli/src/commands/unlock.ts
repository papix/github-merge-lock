import { Command } from 'commander'
import { getRulesetStatus, resolveRulesetName, unlockBranchWithRuleset } from '#core/rulesets/client.js'

type CommandOptions = {
  owner: string
  repo: string
  branch: string
  dryRun?: boolean
  json?: boolean
  rulesetName?: string
}

const outputJson = (payload: unknown) => {
  console.log(JSON.stringify(payload))
}

const formatRulesetSuffix = (options: CommandOptions) => {
  const rulesetName = resolveRulesetName(options.branch, options.rulesetName)
  return ` (ruleset: ${rulesetName})`
}

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const handleDryRun = async (options: CommandOptions) => {
  if (!options.dryRun) {
    return false
  }

  const status = await getRulesetStatus({
    owner: options.owner,
    repo: options.repo,
    branch: options.branch,
    rulesetName: options.rulesetName,
  })
  const currentStatus = status.locked ? 'LOCKED' : 'UNLOCKED'

  if (options.json) {
    outputJson({
      dryRun: true,
      action: 'unlock',
      mode: 'ruleset',
      branch: options.branch,
      owner: options.owner,
      repo: options.repo,
      currentStatus: status.locked,
      rulesetName: status.name,
      rulesetId: status.rulesetId ?? null,
      enforcement: status.enforcement ?? null,
      found: status.found,
    })
    return true
  }

  console.log(
    `[DRY-RUN] Would unlock branch "${options.branch}" in ${options.owner}/${options.repo}${formatRulesetSuffix(options)}`,
  )
  if (status.found) {
    console.log(`Current status: ${currentStatus} (rulesetId: ${status.rulesetId}, enforcement: ${status.enforcement})`)
  } else {
    console.log(`Current status: ${currentStatus} (ruleset not found)`)
  }
  return true
}

const handleSuccess = (options: CommandOptions, changed: boolean) => {
  if (options.json) {
    outputJson({
      success: true,
      changed,
      branch: options.branch,
      owner: options.owner,
      repo: options.repo,
      mode: 'ruleset',
      rulesetName: resolveRulesetName(options.branch, options.rulesetName),
    })
    return
  }

  if (changed) {
    console.log(
      `Unlocked branch "${options.branch}" in ${options.owner}/${options.repo}${formatRulesetSuffix(options)}`,
    )
    return
  }

  console.log(
    `Branch "${options.branch}" is already unlocked in ${options.owner}/${options.repo}${formatRulesetSuffix(options)}`,
  )
}

const handleError = (options: CommandOptions, error: unknown) => {
  const message = toErrorMessage(error)

  if (options.json) {
    outputJson({
      success: false,
      error: message,
    })
    process.exit(1)
  }

  console.error(`Error: ${message}`)
  process.exit(1)
}

export const unlockCommand = new Command('unlock')
  .description('Unlock a branch to allow merges')
  .requiredOption('-o, --owner <owner>', 'Repository owner')
  .requiredOption('-r, --repo <repo>', 'Repository name')
  .requiredOption('-b, --branch <branch>', 'Branch name to unlock')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('--json', 'Output in JSON format')
  .option('--ruleset-name <name>', 'Ruleset name (default: github-merge-lock:<branch>)')
  .action(async (options: CommandOptions) => {
    try {
      if (await handleDryRun(options)) {
        return
      }

      const changed = await unlockBranchWithRuleset({
        owner: options.owner,
        repo: options.repo,
        branch: options.branch,
        rulesetName: options.rulesetName,
      })
      handleSuccess(options, changed)
    } catch (error) {
      handleError(options, error)
    }
  })
