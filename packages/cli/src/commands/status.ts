import { Command } from 'commander'
import { getRulesetStatus, resolveRulesetName } from '#core/rulesets/client.js'

type StatusOptions = {
  owner: string
  repo: string
  branch: string
  json?: boolean
  rulesetName?: string
}

const outputJson = (payload: unknown) => {
  console.log(JSON.stringify(payload))
}

const toErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const handleRulesetStatus = async (options: StatusOptions) => {
  const rulesetStatus = await getRulesetStatus({
    owner: options.owner,
    repo: options.repo,
    branch: options.branch,
    rulesetName: options.rulesetName,
  })

  if (options.json) {
    outputJson({
      locked: rulesetStatus.locked,
      rulesetName: rulesetStatus.name,
      rulesetId: rulesetStatus.rulesetId ?? null,
      enforcement: rulesetStatus.enforcement ?? null,
      found: rulesetStatus.found,
      mode: 'ruleset',
    })
    return
  }

  const resolvedName = resolveRulesetName(options.branch, options.rulesetName)
  console.log(`Branch: ${options.branch}`)
  if (rulesetStatus.found) {
    console.log(`Ruleset: ${resolvedName} (id: ${rulesetStatus.rulesetId})`)
    if (rulesetStatus.enforcement) {
      console.log(`Enforcement: ${rulesetStatus.enforcement}`)
    }
  } else {
    console.log(`Ruleset: ${resolvedName} (not found)`)
  }
  console.log(`Status: ${rulesetStatus.locked ? 'LOCKED' : 'UNLOCKED'}`)
  process.exit(rulesetStatus.locked ? 0 : 1)
}

const handleError = (options: StatusOptions, error: unknown) => {
  if (options.json) {
    outputJson({
      error: toErrorMessage(error),
      mode: 'ruleset',
    })
    process.exit(2)
    return
  }

  console.error(`Error: ${toErrorMessage(error)}`)
  process.exit(2)
}

export const statusCommand = new Command('status')
  .description('Check the lock status of a branch')
  .requiredOption('-o, --owner <owner>', 'Repository owner')
  .requiredOption('-r, --repo <repo>', 'Repository name')
  .requiredOption('-b, --branch <branch>', 'Branch name to check')
  .option('--json', 'Output in JSON format')
  .option('--ruleset-name <name>', 'Ruleset name (default: github-merge-lock:<branch>)')
  .action(async (options: StatusOptions) => {
    try {
      await handleRulesetStatus(options)
    } catch (error) {
      handleError(options, error)
    }
  })
